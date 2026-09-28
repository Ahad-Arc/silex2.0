/**
 * SILEX 2.0 — Workspace Security & API Keys Server Functions
 *
 * Implements developer API key lifecycle management and workspace security:
 * 1. getApiKeysFn — Workspace-scoped query returning safe API key metadata (never raw secrets or hashes)
 * 2. createApiKeyFn — Generates cryptographically secure high-entropy API key, stores SHA-256 hash, returns raw key once
 * 3. revokeApiKeyFn — Revokes/deletes API key with workspace tenant isolation and role verification
 * 4. getSecurityOverviewFn — Returns authenticated user security profile and session metadata
 *
 * CRITICAL SECURITY INVARIANTS:
 * 1. Server-authoritative workspace access: requireWorkspaceAccess() enforces valid session and tenant isolation.
 * 2. Role hierarchy: only 'admin' or 'owner' can create or revoke API keys.
 * 3. Hash-only persistence: raw API keys are NEVER stored in PostgreSQL; only SHA-256 hex hashes are saved.
 * 4. Raw key one-time reveal: raw key is returned exclusively on creation and never returned in getApiKeysFn.
 * 5. $0 Cost & zero paid dependencies: standard node:crypto SHA-256 hashing.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";

// ============================================================================
// Schemas & Types
// ============================================================================

export const getApiKeysInputSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
});

export interface ApiKeyItem {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  maskedKey: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdByName: string;
  createdAt: string;
  isExpired: boolean;
}

export const createApiKeyInputSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  name: z
    .string()
    .trim()
    .min(1, "Key name cannot be empty")
    .max(64, "Key name cannot exceed 64 characters"),
  scopes: z.array(z.string().trim().min(1)).min(1, "At least one scope is required").default(["*"]),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional().default(90),
});

export const revokeApiKeyInputSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  keyId: z.string().uuid("Invalid key ID"),
});

export const getSecurityOverviewInputSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
});

// ============================================================================
// Security Helpers
// ============================================================================

export function hashApiKeyToken(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKeyToken(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const bytes = crypto.randomBytes(24).toString("hex");
  const keyPrefix = "slx_live_";
  const rawKey = `${keyPrefix}${bytes}`;
  const keyHash = hashApiKeyToken(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

export function maskApiKeyPrefix(prefix: string): string {
  return `${prefix}••••`;
}

export function calculateExpirationDate(expiresInDays?: number | null): Date | null {
  if (!expiresInDays) return null;
  return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
}

export interface SecurityOverviewResponse {
  userId: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  workspaceRole: string;
  activeApiKeysCount: number;
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Server Function: getApiKeysFn
 * Retrieves all API keys configured for the active workspace.
 * Masks key secrets and exposes only prefix, name, scopes, and expiration.
 */
export const getApiKeysFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getApiKeysInputSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<{ keys: ApiKeyItem[]; userRole: string }> => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({
      workspaceId: data?.workspaceId,
      requiredRole: "member",
    });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client is uninitialized.");
    }

    const rows = await db
      .select({
        id: apiKeys.id,
        workspaceId: apiKeys.workspaceId,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
        creatorName: users.fullName,
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.createdBy, users.id))
      .where(eq(apiKeys.workspaceId, auth.workspaceId))
      .orderBy(desc(apiKeys.createdAt));

    const now = new Date();

    const keys: ApiKeyItem[] = rows.map((r) => {
      const isExpired = r.expiresAt ? new Date(r.expiresAt) < now : false;
      return {
        id: r.id,
        workspaceId: r.workspaceId,
        name: r.name,
        keyPrefix: r.keyPrefix,
        maskedKey: maskApiKeyPrefix(r.keyPrefix),
        scopes: (r.scopes as string[]) || ["*"],
        lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        createdByName: r.creatorName || "Workspace Member",
        createdAt: r.createdAt.toISOString(),
        isExpired,
      };
    });

    return {
      keys,
      userRole: auth.memberRole,
    };
  });

/**
 * Server Function: createApiKeyFn
 * Generates a high-entropy secret token (slx_live_<48 hex chars>), stores its SHA-256 hash,
 * and returns the raw secret ONCE for the user to copy.
 * Enforces admin or owner role requirement.
 */
export const createApiKeyFn = createServerFn({ method: "POST" })
  .validator((data?: unknown) => createApiKeyInputSchema.parse(data ?? {}))
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean;
      apiKey: ApiKeyItem;
      rawKey: string;
    }> => {
      if (typeof window !== "undefined") {
        throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
      }

      // Enforce Admin or Owner privilege for API key creation
      const auth = await requireWorkspaceAccess({
        workspaceId: data.workspaceId,
        requiredRole: "admin",
      });

      if (!db) {
        throw new Error("DATABASE_ERROR: Database client is uninitialized.");
      }

      // Generate 24 random bytes -> 48 hex characters with slx_live_ prefix
      const { rawKey, keyPrefix, keyHash } = generateApiKeyToken();
      const expiresAt = calculateExpirationDate(data.expiresInDays);

      const [created] = await db
        .insert(apiKeys)
        .values({
          workspaceId: auth.workspaceId,
          name: data.name,
          keyPrefix: keyPrefix,
          keyHash: keyHash,
          scopes: data.scopes,
          expiresAt: expiresAt,
          createdBy: auth.userId,
        })
        .returning();

      const apiKeyItem: ApiKeyItem = {
        id: created.id,
        workspaceId: created.workspaceId,
        name: created.name,
        keyPrefix: created.keyPrefix,
        maskedKey: maskApiKeyPrefix(created.keyPrefix),
        scopes: (created.scopes as string[]) || ["*"],
        lastUsedAt: null,
        expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
        createdByName: auth.appUser.fullName || "Workspace Admin",
        createdAt: created.createdAt.toISOString(),
        isExpired: false,
      };

      return {
        success: true,
        apiKey: apiKeyItem,
        rawKey,
      };
    },
  );

/**
 * Server Function: revokeApiKeyFn
 * Revokes/deletes an API key by ID after verifying workspace multi-tenant ownership.
 * Enforces admin or owner role requirement.
 */
export const revokeApiKeyFn = createServerFn({ method: "POST" })
  .validator((data?: unknown) => revokeApiKeyInputSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<{ success: boolean; revokedId: string }> => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client is uninitialized.");
    }

    const [deleted] = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, data.keyId), eq(apiKeys.workspaceId, auth.workspaceId)))
      .returning({ id: apiKeys.id });

    if (!deleted) {
      throw new Error("API_KEY_NOT_FOUND: The requested API key does not exist or is unauthorized.");
    }

    return {
      success: true,
      revokedId: deleted.id,
    };
  });

/**
 * Server Function: getSecurityOverviewFn
 * Retrieves the current session security overview and active keys count.
 */
export const getSecurityOverviewFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getSecurityOverviewInputSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<SecurityOverviewResponse> => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({
      workspaceId: data?.workspaceId,
      requiredRole: "member",
    });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client is uninitialized.");
    }

    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiKeys)
      .where(eq(apiKeys.workspaceId, auth.workspaceId));

    return {
      userId: auth.userId,
      email: auth.appUser.email,
      fullName: auth.appUser.fullName || "User",
      emailVerified: !!auth.appUser.emailVerifiedAt,
      workspaceRole: auth.memberRole,
      activeApiKeysCount: Number(countRow?.count || 0),
    };
  });

export const getDeploymentReadinessInputSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
});

export interface DeploymentReadinessResponse {
  environment: string;
  serverTime: string;
  database: {
    status: "connected" | "unconfigured" | "error";
    isConfigured: boolean;
  };
  storage: {
    mode: "disabled" | "local" | "supabase";
    isConfigured: boolean;
    providerName: string;
  };
  auth: {
    isConfigured: boolean;
    provider: "supabase";
  };
  automation: {
    isCronConfigured: boolean;
  };
  ai: {
    provider: string;
    isConfigured: boolean;
  };
  billing: {
    mode: "live" | "simulation";
  };
}

/**
 * Server Function: getDeploymentReadinessFn
 * Production launch diagnostics: checks deployment configuration & service status
 * without exposing internal secrets, connection strings, or private keys.
 */
export const getDeploymentReadinessFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getDeploymentReadinessInputSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<DeploymentReadinessResponse> => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    await requireWorkspaceAccess({
      workspaceId: data?.workspaceId,
      requiredRole: "member",
    });

    const isDbConfigured = !!process.env.DATABASE_URL;
    let dbStatus: "connected" | "unconfigured" | "error" = isDbConfigured ? "connected" : "unconfigured";
    if (isDbConfigured && !db) {
      dbStatus = "error";
    }

    const storageMode = (process.env.STORAGE_MODE || "disabled") as "disabled" | "local" | "supabase";
    const isCronConfigured = !!(process.env.CRON_SECRET && process.env.CRON_SECRET.trim().length > 0);
    const isAiConfigured = !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
    const isBillingLive = !!process.env.STRIPE_SECRET_KEY;

    return {
      environment: process.env.NODE_ENV || "production",
      serverTime: new Date().toISOString(),
      database: {
        status: dbStatus,
        isConfigured: isDbConfigured,
      },
      storage: {
        mode: storageMode,
        isConfigured: storageMode !== "disabled",
        providerName:
          storageMode === "supabase"
            ? "Supabase Cloud Storage"
            : storageMode === "local"
              ? "Local Filesystem Sandbox"
              : "Metadata-Only ($0 Invariant)",
      },
      auth: {
        isConfigured: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
        provider: "supabase",
      },
      automation: {
        isCronConfigured,
      },
      ai: {
        provider: process.env.AI_PROVIDER || "gemini",
        isConfigured: isAiConfigured,
      },
      billing: {
        mode: isBillingLive ? "live" : "simulation",
      },
    };
  });
