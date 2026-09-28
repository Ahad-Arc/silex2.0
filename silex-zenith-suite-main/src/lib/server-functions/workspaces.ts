/**
 * SILEX 2.0 — Workspace Settings & Team Management Server Functions
 *
 * Implements workspace-isolated CRUD and security boundaries for:
 * 1. getWorkspaceSettingsFn — retrieve active workspace settings and profile
 * 2. updateWorkspaceSettingsFn — update workspace and billing settings (admin/owner only)
 * 3. getWorkspaceMembersFn — retrieve active member roster with safe fields
 * 4. createWorkspaceInvitationFn — create cryptographically hashed shareable invite ($0 email)
 * 5. updateMemberRoleFn — role hierarchy management with final-owner protection
 * 6. removeWorkspaceMemberFn — member deactivation with final-owner protection
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, isNull, desc, count, ne } from "drizzle-orm";
import { randomBytes, createHash } from "node:crypto";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { db } from "@/db";
import {
  workspaces,
  workspaceMembers,
  workspaceSettings,
  workspaceInvitations,
  users,
} from "@/db/schema";

// ============================================================================
// Input Validation Schemas
// ============================================================================

export const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const getWorkspaceSettingsInputSchema = z.object({
  workspaceId: z.string().optional(),
});

export const updateWorkspaceSettingsInputSchema = z.object({
  workspaceId: z.string().optional(),
  name: z.string().trim().min(1, "Workspace name is required").max(255).optional(),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug must be at most 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase alphanumeric characters and hyphens")
    .optional(),
  logoUrl: z.string().url("Invalid URL").max(2048).nullable().optional(),
  defaultCurrency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter ISO code")
    .regex(/^[A-Z]{3}$/, "Currency must be 3 uppercase letters")
    .optional(),
  fiscalYearStartMonth: z
    .number()
    .int("Fiscal year month must be an integer")
    .min(1, "Month must be between 1 and 12")
    .max(12, "Month must be between 1 and 12")
    .optional(),
  invoicePrefix: z
    .string()
    .trim()
    .min(1, "Invoice prefix cannot be empty")
    .max(20, "Invoice prefix cannot exceed 20 characters")
    .optional(),
  invoiceNextNumber: z
    .number()
    .int("Next invoice number must be an integer")
    .positive("Next invoice number must be positive")
    .optional(),
  taxId: z.string().trim().max(100, "Tax ID cannot exceed 100 characters").nullable().optional(),
  brandingColors: z
    .object({
      primary: z.string().regex(hexColorRegex, "Invalid primary hex color code"),
      secondary: z.string().regex(hexColorRegex, "Invalid secondary hex color code").optional(),
      accent: z.string().regex(hexColorRegex, "Invalid accent hex color code").optional(),
    })
    .optional(),
});

export const getWorkspaceMembersInputSchema = z.object({
  workspaceId: z.string().optional(),
});

export const createWorkspaceInvitationInputSchema = z.object({
  workspaceId: z.string().optional(),
  email: z
    .string()
    .trim()
    .email("A valid email address is required")
    .max(255, "Email cannot exceed 255 characters"),
  role: z.enum(["admin", "member"]).default("member"),
});

export const updateMemberRoleInputSchema = z.object({
  workspaceId: z.string().optional(),
  memberId: z.string().uuid("Invalid member ID"),
  role: z.enum(["owner", "admin", "member"]),
});

export const removeWorkspaceMemberInputSchema = z.object({
  workspaceId: z.string().optional(),
  memberId: z.string().uuid("Invalid member ID"),
});

// ============================================================================
// Helper Invariants
// ============================================================================

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(rawToken);
  return { rawToken, tokenHash };
}

// Role hierarchy rank
export const ROLE_HIERARCHY: Record<string, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Server Function: getWorkspaceSettingsFn
 * Returns the authenticated user's active workspace profile and configuration.
 */
export const getWorkspaceSettingsFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getWorkspaceSettingsInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const wsRows = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        logoUrl: workspaces.logoUrl,
        planTier: workspaces.planTier,
        ownerId: workspaces.ownerId,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaces)
      .where(and(eq(workspaces.id, auth.workspaceId), isNull(workspaces.deletedAt)))
      .limit(1);

    if (wsRows.length === 0) {
      throw new Error("WORKSPACE_NOT_FOUND: Workspace not found or has been deleted.");
    }

    const ws = wsRows[0];

    const settingsRows = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, auth.workspaceId))
      .limit(1);

    const settings = settingsRows[0] || null;

    return {
      workspace: {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        logoUrl: ws.logoUrl,
        planTier: ws.planTier,
        ownerId: ws.ownerId,
        createdAt: ws.createdAt.toISOString(),
        updatedAt: ws.updatedAt.toISOString(),
      },
      settings: {
        id: settings?.id ?? null,
        workspaceId: auth.workspaceId,
        defaultCurrency: settings?.defaultCurrency ?? "USD",
        fiscalYearStartMonth: settings?.fiscalYearStartMonth ?? 1,
        invoicePrefix: settings?.invoicePrefix ?? "INV-",
        invoiceNextNumber: settings?.invoiceNextNumber ?? 1001,
        taxId: settings?.taxId ?? null,
        brandingColors: settings?.brandingColors ?? { primary: "#0F172A" },
        updatedAt: settings?.updatedAt
          ? settings.updatedAt.toISOString()
          : ws.updatedAt.toISOString(),
      },
      userRole: auth.memberRole,
    };
  });

/**
 * Server Function: updateWorkspaceSettingsFn
 * Updates workspace profile details and configuration.
 * Requires "admin" or "owner" role.
 */
export const updateWorkspaceSettingsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateWorkspaceSettingsInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // If slug is provided and modified, check uniqueness across active workspaces
    if (data.slug && data.slug !== auth.workspace.slug) {
      const slugConflict = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.slug, data.slug),
            ne(workspaces.id, auth.workspaceId),
            isNull(workspaces.deletedAt),
          ),
        )
        .limit(1);

      if (slugConflict.length > 0) {
        throw new Error("SLUG_ALREADY_EXISTS: The specified workspace slug is already in use.");
      }
    }

    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Update workspaces table if workspace metadata provided
      const wsUpdates: Record<string, unknown> = { updatedAt: now };
      if (data.name !== undefined) wsUpdates.name = data.name;
      if (data.slug !== undefined) wsUpdates.slug = data.slug;
      if (data.logoUrl !== undefined) wsUpdates.logoUrl = data.logoUrl;

      let updatedWs = auth.workspace;
      if (Object.keys(wsUpdates).length > 1) {
        const [ws] = await tx
          .update(workspaces)
          .set(wsUpdates)
          .where(eq(workspaces.id, auth.workspaceId))
          .returning();
        if (ws) updatedWs = ws;
      }

      // 2. Upsert workspaceSettings
      const existingSettings = await tx
        .select()
        .from(workspaceSettings)
        .where(eq(workspaceSettings.workspaceId, auth.workspaceId))
        .limit(1);

      let finalSettings;

      if (existingSettings.length > 0) {
        const settingsUpdates: Record<string, unknown> = { updatedAt: now };
        if (data.defaultCurrency !== undefined) settingsUpdates.defaultCurrency = data.defaultCurrency;
        if (data.fiscalYearStartMonth !== undefined)
          settingsUpdates.fiscalYearStartMonth = data.fiscalYearStartMonth;
        if (data.invoicePrefix !== undefined) settingsUpdates.invoicePrefix = data.invoicePrefix;
        if (data.invoiceNextNumber !== undefined)
          settingsUpdates.invoiceNextNumber = data.invoiceNextNumber;
        if (data.taxId !== undefined) settingsUpdates.taxId = data.taxId;
        if (data.brandingColors !== undefined)
          settingsUpdates.brandingColors = data.brandingColors;

        const [saved] = await tx
          .update(workspaceSettings)
          .set(settingsUpdates)
          .where(eq(workspaceSettings.workspaceId, auth.workspaceId))
          .returning();
        finalSettings = saved;
      } else {
        const [created] = await tx
          .insert(workspaceSettings)
          .values({
            workspaceId: auth.workspaceId,
            defaultCurrency: data.defaultCurrency ?? "USD",
            fiscalYearStartMonth: data.fiscalYearStartMonth ?? 1,
            invoicePrefix: data.invoicePrefix ?? "INV-",
            invoiceNextNumber: data.invoiceNextNumber ?? 1001,
            taxId: data.taxId ?? null,
            brandingColors: data.brandingColors ?? { primary: "#0F172A" },
          })
          .returning();
        finalSettings = created;
      }

      return {
        workspace: updatedWs,
        settings: finalSettings,
      };
    });

    return {
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        slug: result.workspace.slug,
        logoUrl: result.workspace.logoUrl,
        planTier: result.workspace.planTier,
        ownerId: result.workspace.ownerId,
        createdAt: result.workspace.createdAt.toISOString(),
        updatedAt: result.workspace.updatedAt.toISOString(),
      },
      settings: {
        id: result.settings.id,
        workspaceId: result.settings.workspaceId,
        defaultCurrency: result.settings.defaultCurrency,
        fiscalYearStartMonth: result.settings.fiscalYearStartMonth,
        invoicePrefix: result.settings.invoicePrefix,
        invoiceNextNumber: result.settings.invoiceNextNumber,
        taxId: result.settings.taxId,
        brandingColors: result.settings.brandingColors,
        updatedAt: result.settings.updatedAt.toISOString(),
      },
      userRole: auth.memberRole,
    };
  });

/**
 * Server Function: getWorkspaceMembersFn
 * Returns the active workspace member roster with safe identity fields.
 */
export const getWorkspaceMembersFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getWorkspaceMembersInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const roster = await db
      .select({
        id: workspaceMembers.id,
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        jobTitle: workspaceMembers.jobTitle,
        status: workspaceMembers.status,
        joinedAt: workspaceMembers.joinedAt,
        createdAt: workspaceMembers.createdAt,
        userName: users.fullName,
        userEmail: users.email,
        userAvatar: users.avatarUrl,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, auth.workspaceId),
          eq(workspaceMembers.status, "active"),
        ),
      )
      .orderBy(desc(workspaceMembers.createdAt));

    return {
      members: roster.map((m) => ({
        id: m.id,
        workspaceId: m.workspaceId,
        userId: m.userId,
        role: m.role,
        jobTitle: m.jobTitle,
        status: m.status,
        joinedAt: m.joinedAt.toISOString(),
        createdAt: m.createdAt.toISOString(),
        user: {
          id: m.userId,
          fullName: m.userName,
          email: m.userEmail,
          avatarUrl: m.userAvatar,
        },
      })),
      totalCount: roster.length,
    };
  });

/**
 * Server Function: createWorkspaceInvitationFn
 * Generates a high-entropy, cryptographically secure shareable invitation token.
 * Stores only the SHA-256 hash. Zero external email dependencies ($0 cost).
 * Requires "admin" or "owner" role.
 */
export const createWorkspaceInvitationFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createWorkspaceInvitationInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const normalizedEmail = data.email.toLowerCase();

    // 1. Check if user is already an active member of this workspace
    const existingMember = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, auth.workspaceId),
          eq(users.email, normalizedEmail),
          eq(workspaceMembers.status, "active"),
        ),
      )
      .limit(1);

    if (existingMember.length > 0) {
      throw new Error("MEMBER_ALREADY_EXISTS: User is already an active member of this workspace.");
    }

    // 2. Check if a non-expired pending invitation already exists for this email
    const pendingInvite = await db
      .select({ id: workspaceInvitations.id, expiresAt: workspaceInvitations.expiresAt })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, auth.workspaceId),
          eq(workspaceInvitations.email, normalizedEmail),
          eq(workspaceInvitations.status, "pending"),
        ),
      )
      .limit(1);

    const now = new Date();
    if (pendingInvite.length > 0 && pendingInvite[0].expiresAt > now) {
      throw new Error(
        "INVITATION_ALREADY_EXISTS: A pending invitation has already been issued to this email.",
      );
    }

    // 3. Cryptographic token generation: raw high-entropy token + SHA-256 hash
    const { rawToken, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day expiration

    const [invite] = await db
      .insert(workspaceInvitations)
      .values({
        workspaceId: auth.workspaceId,
        email: normalizedEmail,
        role: data.role,
        tokenHash: tokenHash,
        invitedByUserId: auth.userId,
        status: "pending",
        expiresAt: expiresAt,
      })
      .returning();

    return {
      invitation: {
        id: invite.id,
        workspaceId: invite.workspaceId,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
      },
      rawToken,
      invitationLink: `/auth?invitation=${rawToken}`,
    };
  });

/**
 * Server Function: updateMemberRoleFn
 * Modifies a member's role within the authorized workspace.
 * Enforces role hierarchy, self-mutation prohibition, and final-owner protection.
 * Requires "admin" or "owner" role.
 */
export const updateMemberRoleFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateMemberRoleInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // 1. Verify target member belongs to this workspace
    const targetRows = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        status: workspaceMembers.status,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.id, data.memberId),
          eq(workspaceMembers.workspaceId, auth.workspaceId),
        ),
      )
      .limit(1);

    if (targetRows.length === 0) {
      throw new Error("MEMBER_NOT_FOUND: Member not found in this workspace.");
    }

    const target = targetRows[0];

    // Invariant A: Users cannot modify their own role (prevents self-demotion or self-elevation)
    if (target.userId === auth.userId) {
      throw new Error("CANNOT_MODIFY_OWN_ROLE: Users cannot modify their own workspace role.");
    }

    // Invariant B: Role hierarchy enforcement for admins
    if (auth.memberRole === "admin") {
      if (target.role === "owner") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Admins cannot modify workspace owners.");
      }
      if (target.role === "admin") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Admins cannot modify other administrators.");
      }
      if (data.role === "owner") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Only workspace owners can promote members to owner.");
      }
    }

    // Invariant C: Final-owner protection (cannot demote the last remaining owner)
    if (target.role === "owner" && data.role !== "owner") {
      const [ownerCountResult] = await db
        .select({ total: count() })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, auth.workspaceId),
            eq(workspaceMembers.role, "owner"),
            eq(workspaceMembers.status, "active"),
          ),
        );

      const activeOwners = Number(ownerCountResult?.total ?? 0);
      if (activeOwners <= 1) {
        throw new Error(
          "FINAL_OWNER_PROTECTION: Cannot demote the final owner of the workspace.",
        );
      }
    }

    // 2. Perform role update
    const [updated] = await db
      .update(workspaceMembers)
      .set({
        role: data.role,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceMembers.id, data.memberId),
          eq(workspaceMembers.workspaceId, auth.workspaceId),
        ),
      )
      .returning();

    return {
      success: true,
      memberId: updated.id,
      newRole: updated.role,
      updatedAt: updated.updatedAt.toISOString(),
    };
  });

/**
 * Server Function: removeWorkspaceMemberFn
 * Deactivates a member in the workspace per schema semantics.
 * Enforces role hierarchy and final-owner protection.
 * Requires "admin" or "owner" role.
 */
export const removeWorkspaceMemberFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => removeWorkspaceMemberInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // 1. Verify target member belongs to this workspace
    const targetRows = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        status: workspaceMembers.status,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.id, data.memberId),
          eq(workspaceMembers.workspaceId, auth.workspaceId),
        ),
      )
      .limit(1);

    if (targetRows.length === 0) {
      throw new Error("MEMBER_NOT_FOUND: Member not found in this workspace.");
    }

    const target = targetRows[0];

    if (target.status !== "active") {
      throw new Error("MEMBER_ALREADY_INACTIVE: Member is already deactivated or inactive.");
    }

    // Invariant A: Admin cannot remove owner or other admins
    if (auth.memberRole === "admin") {
      if (target.role === "owner") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Admins cannot remove workspace owners.");
      }
      if (target.role === "admin") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Admins cannot remove other administrators.");
      }
    }

    // Invariant B: Final-owner protection (cannot remove final owner, even self)
    if (target.role === "owner") {
      const [ownerCountResult] = await db
        .select({ total: count() })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, auth.workspaceId),
            eq(workspaceMembers.role, "owner"),
            eq(workspaceMembers.status, "active"),
          ),
        );

      const activeOwners = Number(ownerCountResult?.total ?? 0);
      if (activeOwners <= 1) {
        throw new Error(
          "FINAL_OWNER_PROTECTION: Cannot remove the final owner of the workspace.",
        );
      }
    }

    // 2. Soft-deactivate per schema semantics
    await db
      .update(workspaceMembers)
      .set({
        status: "deactivated",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceMembers.id, data.memberId),
          eq(workspaceMembers.workspaceId, auth.workspaceId),
        ),
      );

    return {
      success: true,
      memberId: data.memberId,
      status: "deactivated",
    };
  });
