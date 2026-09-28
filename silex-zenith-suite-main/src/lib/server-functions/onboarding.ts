/**
 * SILEX 2.0 — Onboarding & Workspace Provisioning Server Functions
 *
 * Implements authenticated onboarding state query and workspace provisioning:
 * 1. getOnboardingStateFn — fetches user profile basics, existing preferences, and active workspace status
 * 2. completeOnboardingFn — transactionally configures user profile, workspace, settings, and initial preferences
 *
 * CRITICAL SECURITY & MULTI-TENANT INVARIANTS:
 * 1. User identity is derived exclusively via getServerAuthContext().
 * 2. Client-provided user IDs are NEVER accepted or trusted.
 * 3. Atomic Drizzle transaction (db.transaction) ensures all-or-nothing provisioning.
 * 4. Slugs are validated and collision-guarded (unique across active workspaces).
 * 5. Zero physical storage dependencies: metadata and configuration only.
 * 6. Zero schema migrations: reuses users, user_preferences, workspaces, workspace_members, workspace_settings.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, isNull, ne } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getServerAuthContext, AuthContextError } from "@/lib/supabase/server-context";
import { db } from "@/db";
import {
  workspaces,
  workspaceMembers,
  workspaceSettings,
  userPreferences,
  users,
} from "@/db/schema";

// ============================================================================
// Input Validation Schemas
// ============================================================================

export const BUSINESS_TYPES = [
  "freelancer",
  "creative_studio",
  "agency",
  "startup",
  "consultant",
  "other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const completeOnboardingInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(255, "Full name cannot exceed 255 characters"),
  companyName: z
    .string()
    .trim()
    .max(255, "Company name cannot exceed 255 characters")
    .optional()
    .default(""),
  website: z
    .string()
    .trim()
    .max(255, "Website cannot exceed 255 characters")
    .optional()
    .default(""),
  businessType: z
    .string()
    .trim()
    .max(100, "Business type cannot exceed 100 characters")
    .optional()
    .default("freelancer"),
  workspaceName: z
    .string()
    .trim()
    .min(1, "Workspace name is required")
    .max(255, "Workspace name cannot exceed 255 characters"),
  workspaceSlug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug cannot exceed 100 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase alphanumeric characters and hyphens",
    ),
  currency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter ISO code")
    .regex(/^[A-Z]{3}$/, "Currency must be 3 uppercase letters")
    .default("USD"),
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingInputSchema>;

export interface OnboardingStateResponse {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
  } | null;
  profile: {
    companyName: string;
    website: string;
    businessType: string;
  } | null;
  workspace: {
    id: string;
    name: string;
    slug: string;
    currency: string;
  } | null;
  isComplete: boolean;
}

export interface CompleteOnboardingResponse {
  success: boolean;
  workspaceId: string;
  workspaceName: string;
  slug: string;
  currency: string;
}

// ============================================================================
// Helper: Clean Slug Normalizer
// ============================================================================

export function sanitizeWorkspaceSlug(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.length >= 2 ? normalized.slice(0, 100) : `ws-${randomBytes(3).toString("hex")}`;
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * 1. getOnboardingStateFn — Safely retrieves prefill state for onboarding
 */
export const getOnboardingStateFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<OnboardingStateResponse> => {
    if (typeof window !== "undefined") {
      throw new Error(
        "[SILEX Security Guard] getOnboardingStateFn invoked in client browser context.",
      );
    }

    try {
      const authContext = await getServerAuthContext();
      const { userId, appUser } = authContext;

      if (!db) {
        return {
          isAuthenticated: true,
          user: {
            id: appUser.id,
            email: appUser.email,
            fullName: appUser.fullName,
            avatarUrl: appUser.avatarUrl,
          },
          profile: {
            companyName: "",
            website: "",
            businessType: "freelancer",
          },
          workspace: null,
          isComplete: false,
        };
      }

      // 1. Fetch user preferences / stored uiConfig
      const prefs = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      const uiConfig = (prefs[0]?.uiConfig || {}) as Record<string, unknown>;

      // 2. Fetch existing active workspace (if user already owns or belongs to one)
      const memberships = await db
        .select({
          workspace: workspaces,
          settings: workspaceSettings,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .leftJoin(workspaceSettings, eq(workspaceSettings.workspaceId, workspaces.id))
        .where(
          and(
            eq(workspaceMembers.userId, userId),
            eq(workspaceMembers.status, "active"),
            isNull(workspaces.deletedAt),
          ),
        )
        .limit(1);

      const activeWorkspace = memberships[0]?.workspace;
      const activeSettings = memberships[0]?.settings;
      const isComplete = Boolean(uiConfig.onboardingCompleted);

      return {
        isAuthenticated: true,
        user: {
          id: appUser.id,
          email: appUser.email,
          fullName: appUser.fullName,
          avatarUrl: appUser.avatarUrl,
        },
        profile: {
          companyName: typeof uiConfig.companyName === "string" ? uiConfig.companyName : "",
          website: typeof uiConfig.website === "string" ? uiConfig.website : "",
          businessType: typeof uiConfig.businessType === "string" ? uiConfig.businessType : "freelancer",
        },
        workspace: activeWorkspace
          ? {
              id: activeWorkspace.id,
              name: activeWorkspace.name,
              slug: activeWorkspace.slug,
              currency: activeSettings?.defaultCurrency || "USD",
            }
          : null,
        isComplete,
      };
    } catch {
      return {
        isAuthenticated: false,
        user: null,
        profile: null,
        workspace: null,
        isComplete: false,
      };
    }
  },
);

/**
 * 2. completeOnboardingFn — Atomically provisions/updates workspace & profile
 */
export const completeOnboardingFn = createServerFn({ method: "POST" })
  .validator((rawInput: unknown): CompleteOnboardingInput => {
    return completeOnboardingInputSchema.parse(rawInput);
  })
  .handler(async ({ data: input }): Promise<CompleteOnboardingResponse> => {
    if (typeof window !== "undefined") {
      throw new Error(
        "[SILEX Security Guard] completeOnboardingFn invoked in client browser context.",
      );
    }

    const authContext = await getServerAuthContext();
    const { userId } = authContext;

    if (!db) {
      throw new AuthContextError(
        "DATABASE_ERROR",
        "Database handle is uninitialized.",
      );
    }

    return await db.transaction(async (tx) => {
      // 1. Update user full name
      await tx
        .update(users)
        .set({
          fullName: input.fullName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // 2. Upsert user preferences & uiConfig
      const existingPrefs = await tx
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      const updatedUiConfig = {
        ...(existingPrefs[0]?.uiConfig || {}),
        companyName: input.companyName,
        website: input.website,
        businessType: input.businessType,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      };

      if (existingPrefs.length > 0) {
        await tx
          .update(userPreferences)
          .set({
            uiConfig: updatedUiConfig,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.userId, userId));
      } else {
        await tx.insert(userPreferences).values({
          userId,
          uiConfig: updatedUiConfig,
        });
      }

      // 3. Find if user already owns an active workspace
      const existingOwnerWorkspaces = await tx
        .select({
          workspace: workspaces,
          member: workspaceMembers,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(
          and(
            eq(workspaceMembers.userId, userId),
            eq(workspaceMembers.role, "owner"),
            eq(workspaceMembers.status, "active"),
            isNull(workspaces.deletedAt),
          ),
        )
        .limit(1);

      // Check slug collision
      const desiredSlug = sanitizeWorkspaceSlug(input.workspaceSlug);
      const existingWorkspaceId = existingOwnerWorkspaces[0]?.workspace.id;

      const conflictingSlugRows = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.slug, desiredSlug),
            isNull(workspaces.deletedAt),
            existingWorkspaceId ? ne(workspaces.id, existingWorkspaceId) : undefined,
          ),
        )
        .limit(1);

      let finalSlug = desiredSlug;
      if (conflictingSlugRows.length > 0) {
        finalSlug = `${desiredSlug}-${randomBytes(2).toString("hex")}`;
      }

      let activeWorkspaceId: string;

      if (existingOwnerWorkspaces.length > 0) {
        // Update existing owned workspace
        activeWorkspaceId = existingOwnerWorkspaces[0].workspace.id;
        await tx
          .update(workspaces)
          .set({
            name: input.workspaceName,
            slug: finalSlug,
            updatedAt: new Date(),
          })
          .where(eq(workspaces.id, activeWorkspaceId));

        // Update member job title if provided
        if (input.businessType) {
          const displayRole = input.businessType.replace(/_/g, " ");
          await tx
            .update(workspaceMembers)
            .set({
              jobTitle: displayRole.charAt(0).toUpperCase() + displayRole.slice(1),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(workspaceMembers.workspaceId, activeWorkspaceId),
                eq(workspaceMembers.userId, userId),
              ),
            );
        }
      } else {
        // Provision new workspace
        const [newWorkspace] = await tx
          .insert(workspaces)
          .values({
            name: input.workspaceName,
            slug: finalSlug,
            ownerId: userId,
            planTier: "free",
            isActive: true,
          })
          .returning();

        activeWorkspaceId = newWorkspace.id;

        const displayRole = input.businessType ? input.businessType.replace(/_/g, " ") : "Founder";
        await tx.insert(workspaceMembers).values({
          workspaceId: activeWorkspaceId,
          userId,
          role: "owner",
          status: "active",
          jobTitle: displayRole.charAt(0).toUpperCase() + displayRole.slice(1),
        });
      }

      // 4. Upsert workspace settings (currency & defaults)
      const existingSettings = await tx
        .select()
        .from(workspaceSettings)
        .where(eq(workspaceSettings.workspaceId, activeWorkspaceId))
        .limit(1);

      if (existingSettings.length > 0) {
        await tx
          .update(workspaceSettings)
          .set({
            defaultCurrency: input.currency,
            updatedAt: new Date(),
          })
          .where(eq(workspaceSettings.workspaceId, activeWorkspaceId));
      } else {
        await tx.insert(workspaceSettings).values({
          workspaceId: activeWorkspaceId,
          defaultCurrency: input.currency,
          fiscalYearStartMonth: 1,
          invoicePrefix: "INV-",
          invoiceNextNumber: 1001,
          brandingColors: { primary: "#0F172A" },
        });
      }

      return {
        success: true,
        workspaceId: activeWorkspaceId,
        workspaceName: input.workspaceName,
        slug: finalSlug,
        currency: input.currency,
      };
    });
  });
