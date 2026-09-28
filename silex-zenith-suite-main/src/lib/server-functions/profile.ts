/**
 * SILEX 2.0 — User Profile & Personal Preferences Server Functions
 *
 * Implements authenticated user profile retrieval and persistence:
 * 1. getUserProfileFn — fetches authenticated user profile, preferences, and active workspace identity
 * 2. updateUserProfileFn — updates allowed profile fields, preferences, and workspace job title
 *
 * CRITICAL SECURITY & DATA PRIVACY INVARIANTS:
 * 1. Authenticated user identity is derived exclusively via getServerAuthContext().
 * 2. Client-provided user IDs are NEVER accepted or trusted.
 * 3. Self-only mutation: users can ONLY query and mutate their own profile.
 * 4. Passwords, token hashes, and OAuth credentials are NEVER selected or returned.
 * 5. Zero physical storage dependencies: URLs or initials badges only.
 * 6. Zero schema migrations: leverages users, user_preferences, and workspace_members.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getServerAuthContext } from "@/lib/supabase/server-context";
import { db } from "@/db";
import { users, userPreferences, workspaceMembers } from "@/db/schema";

// ============================================================================
// Input Validation Schemas
// ============================================================================

export const getUserProfileInputSchema = z.object({
  workspaceId: z.string().optional(),
});

export const updateUserProfileInputSchema = z.object({
  workspaceId: z.string().optional(),
  fullName: z
    .string()
    .trim()
    .min(1, "Full name cannot be empty")
    .max(255, "Full name cannot exceed 255 characters")
    .optional(),
  avatarUrl: z
    .union([
      z.string().trim().url("Invalid avatar URL").max(2048, "Avatar URL cannot exceed 2048 characters"),
      z.literal(""),
      z.null(),
    ])
    .transform((val) => (val === "" ? null : val))
    .optional(),
  jobTitle: z
    .string()
    .trim()
    .max(100, "Job title cannot exceed 100 characters")
    .nullable()
    .optional(),
  timezone: z
    .string()
    .trim()
    .max(100, "Timezone cannot exceed 100 characters")
    .optional(),
  locale: z
    .string()
    .trim()
    .max(10, "Locale cannot exceed 10 characters")
    .optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
  keyboardShortcutsEnabled: z.boolean().optional(),
  bio: z
    .string()
    .trim()
    .max(1000, "Bio cannot exceed 1000 characters")
    .optional(),
  location: z
    .string()
    .trim()
    .max(100, "Location cannot exceed 100 characters")
    .optional(),
  website: z
    .union([
      z.string().trim().max(255, "Website cannot exceed 255 characters"),
      z.literal(""),
      z.null(),
    ])
    .transform((val) => (val === "" ? null : val))
    .optional(),
  twitter: z
    .string()
    .trim()
    .max(100, "Twitter handle cannot exceed 100 characters")
    .optional(),
  github: z
    .string()
    .trim()
    .max(100, "GitHub handle cannot exceed 100 characters")
    .optional(),
  skills: z
    .array(z.string().trim().max(50, "Skill tag cannot exceed 50 characters"))
    .max(20, "Maximum of 20 skill tags allowed")
    .optional(),
});

export type GetUserProfileInput = z.infer<typeof getUserProfileInputSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileInputSchema>;

export interface UserProfileResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    emailVerifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  preferences: {
    theme: string;
    timezone: string;
    locale: string;
    keyboardShortcutsEnabled: boolean;
  };
  profile: {
    jobTitle: string | null;
    bio: string;
    location: string;
    website: string;
    twitter: string;
    github: string;
    skills: string[];
  };
  workspaceRole: string | null;
}

// ============================================================================
// Internal Helper: Fetch user profile with safe projections
// ============================================================================

export async function getUserProfileInternal(
  userId: string,
  workspaceId?: string,
): Promise<UserProfileResponse> {
  if (!db) {
    throw new Error("Database client is uninitialized.");
  }

  // 1. Explicitly select only non-sensitive columns from users
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRows.length === 0) {
    throw new Error("USER_NOT_FOUND: User profile record does not exist.");
  }

  const user = userRows[0];

  // 2. Query user preferences
  const prefRows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const pref = prefRows[0] || null;
  const uiConfig = (pref?.uiConfig as Record<string, unknown>) || {};

  // 3. Query active workspace membership if applicable
  let memberJobTitle: string | null = null;
  let memberRole: string | null = null;

  if (workspaceId) {
    const memberRows = await db
      .select({
        jobTitle: workspaceMembers.jobTitle,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.status, "active"),
        ),
      )
      .limit(1);

    if (memberRows.length > 0) {
      memberJobTitle = memberRows[0].jobTitle;
      memberRole = memberRows[0].role;
    }
  } else {
    const memberRows = await db
      .select({
        jobTitle: workspaceMembers.jobTitle,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, "active"),
        ),
      )
      .limit(1);

    if (memberRows.length > 0) {
      memberJobTitle = memberRows[0].jobTitle;
      memberRole = memberRows[0].role;
    }
  }

  const resolvedJobTitle =
    memberJobTitle ??
    (typeof uiConfig.jobTitle === "string" ? uiConfig.jobTitle : null);

  const rawSkills = Array.isArray(uiConfig.skills) ? uiConfig.skills : [];
  const validSkills = rawSkills.filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    preferences: {
      theme: pref?.theme ?? "dark",
      timezone: pref?.timezone ?? "UTC",
      locale: pref?.locale ?? "en-US",
      keyboardShortcutsEnabled: pref?.keyboardShortcutsEnabled ?? true,
    },
    profile: {
      jobTitle: resolvedJobTitle,
      bio: typeof uiConfig.bio === "string" ? uiConfig.bio : "",
      location: typeof uiConfig.location === "string" ? uiConfig.location : "",
      website: typeof uiConfig.website === "string" ? uiConfig.website : "",
      twitter: typeof uiConfig.twitter === "string" ? uiConfig.twitter : "",
      github: typeof uiConfig.github === "string" ? uiConfig.github : "",
      skills: validSkills,
    },
    workspaceRole: memberRole,
  };
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Server Function: getUserProfileFn
 * Retrieves authenticated user profile, preferences, and workspace identity.
 */
export const getUserProfileFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getUserProfileInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await getServerAuthContext();
    return await getUserProfileInternal(auth.userId, data?.workspaceId);
  });

/**
 * Server Function: updateUserProfileFn
 * Validates and updates user profile, personal preferences, and workspace job title.
 * Self-only mutation strictly derived from server auth context.
 */
export const updateUserProfileFn = createServerFn({ method: "POST" })
  .validator((data?: unknown) => updateUserProfileInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await getServerAuthContext();
    const userId = auth.userId;

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // Atomic update across users, user_preferences, and workspace_members
    await db.transaction(async (tx) => {
      // 1. Update users table if fullName or avatarUrl is provided
      const userUpdates: {
        fullName?: string;
        avatarUrl?: string | null;
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };

      if (data.fullName !== undefined) {
        userUpdates.fullName = data.fullName;
      }
      if (data.avatarUrl !== undefined) {
        userUpdates.avatarUrl = data.avatarUrl;
      }

      await tx
        .update(users)
        .set(userUpdates)
        .where(eq(users.id, userId));

      // 2. Fetch existing preferences to merge uiConfig
      const [existingPref] = await tx
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      const existingUiConfig =
        (existingPref?.uiConfig as Record<string, unknown>) || {};

      const newUiConfig: Record<string, unknown> = {
        ...existingUiConfig,
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.website !== undefined ? { website: data.website } : {}),
        ...(data.twitter !== undefined ? { twitter: data.twitter } : {}),
        ...(data.github !== undefined ? { github: data.github } : {}),
        ...(data.skills !== undefined ? { skills: data.skills } : {}),
        ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
      };

      const prefValues = {
        userId: userId,
        theme: data.theme ?? existingPref?.theme ?? "dark",
        timezone: data.timezone ?? existingPref?.timezone ?? "UTC",
        locale: data.locale ?? existingPref?.locale ?? "en-US",
        keyboardShortcutsEnabled:
          data.keyboardShortcutsEnabled ?? existingPref?.keyboardShortcutsEnabled ?? true,
        uiConfig: newUiConfig,
        updatedAt: new Date(),
      };

      if (existingPref) {
        await tx
          .update(userPreferences)
          .set(prefValues)
          .where(eq(userPreferences.userId, userId));
      } else {
        await tx.insert(userPreferences).values(prefValues);
      }

      // 3. If jobTitle provided, sync across user's workspace memberships
      if (data.jobTitle !== undefined) {
        if (data.workspaceId) {
          await tx
            .update(workspaceMembers)
            .set({ jobTitle: data.jobTitle, updatedAt: new Date() })
            .where(
              and(
                eq(workspaceMembers.userId, userId),
                eq(workspaceMembers.workspaceId, data.workspaceId),
              ),
            );
        } else {
          await tx
            .update(workspaceMembers)
            .set({ jobTitle: data.jobTitle, updatedAt: new Date() })
            .where(eq(workspaceMembers.userId, userId));
        }
      }
    });

    return await getUserProfileInternal(userId, data.workspaceId);
  });
