import { createSupabaseServerClient, type CookieAdapter } from "./server";
export type { CookieAdapter };

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import type { InferSelectModel } from "drizzle-orm";

export type ApplicationUser = InferSelectModel<typeof users>;

export interface ServerAuthContext {
  authUser: User;
  userId: string;
  appUser: ApplicationUser;
}

export type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "USER_NOT_PROVISIONED"
  | "DATABASE_ERROR";

export class AuthContextError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = "AuthContextError";
  }
}

/**
 * Server-Side Authentication & Identity Context Helper.
 *
 * CRITICAL SECURITY & ARCHITECTURE RULES:
 * 1. MUST ONLY be called in server-side contexts (TanStack Start server functions, SSR loaders, API endpoints).
 * 2. Validates the incoming Supabase JWT session via @supabase/ssr.
 * 3. Resolves and returns the authenticated user's database record from public.users.
 * 4. Provides safe fallback auto-provisioning if the PostgreSQL trigger has not executed yet.
 * 5. NEVER trusts browser-supplied user IDs or workspace IDs.
 */
export async function getServerAuthContext(
  cookieAdapter?: CookieAdapter,
): Promise<ServerAuthContext> {
  // Browser execution guard
  if (typeof window !== "undefined") {
    throw new AuthContextError(
      "UNAUTHENTICATED",
      "[SILEX Security Guard] getServerAuthContext was invoked in client browser context. Server auth context must remain server-side.",
    );
  }

  // 1. Initialize Supabase Server Client
  const supabase = createSupabaseServerClient(cookieAdapter);

  // 2. Validate Session / Auth User from Supabase JWT
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AuthContextError(
      "UNAUTHENTICATED",
      "Authentication required. No active session or valid authorization token found.",
      authError,
    );
  }

  // 3. Ensure Drizzle runtime database connection is available
  if (!db) {
    throw new AuthContextError(
      "DATABASE_ERROR",
      "Database client is unconfigured or uninitialized on the server.",
    );
  }

  try {
    // 4. Query application user record from public.users
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (existingUsers.length > 0) {
      return {
        authUser: user,
        userId: user.id,
        appUser: existingUsers[0],
      };
    }

    // 5. Fallback Auto-Provisioning: If trigger has not fired yet, provision now via server-side Drizzle query
    const email = user.email ?? "";
    const fullName =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      email.split("@")[0] ||
      "User";
    const avatarUrl = (user.user_metadata?.avatar_url as string) || null;

    const [insertedUser] = await db
      .insert(users)
      .values({
        id: user.id,
        email: email,
        fullName: fullName,
        avatarUrl: avatarUrl,
        emailVerifiedAt: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
        isActive: true,
        isSuperAdmin: false,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: email,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!insertedUser) {
      throw new AuthContextError(
        "USER_NOT_PROVISIONED",
        "Failed to resolve or auto-provision application user record in public.users.",
      );
    }

    return {
      authUser: user,
      userId: user.id,
      appUser: insertedUser,
    };
  } catch (err) {
    if (err instanceof AuthContextError) throw err;
    throw new AuthContextError(
      "DATABASE_ERROR",
      "An unexpected database error occurred while resolving server authentication context.",
      err,
    );
  }
}
