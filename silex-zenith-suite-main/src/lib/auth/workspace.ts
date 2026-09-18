import {
  getServerAuthContext,
  AuthContextError,
  type ServerAuthContext,
  type CookieAdapter,
} from "@/lib/supabase/server-context";
import { db } from "@/db";
import { workspaces, workspaceMembers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type Workspace = InferSelectModel<typeof workspaces>;
export type WorkspaceMember = InferSelectModel<typeof workspaceMembers>;

export interface AuthorizedWorkspaceContext extends ServerAuthContext {
  workspace: Workspace;
  workspaceId: string;
  memberRole: string;
}

export type WorkspaceAccessErrorCode =
  | "UNAUTHORIZED_WORKSPACE"
  | "NO_WORKSPACE_FOUND"
  | "DATABASE_ERROR";

export class WorkspaceAccessError extends Error {
  constructor(
    public code: WorkspaceAccessErrorCode,
    message: string,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

export interface RequireWorkspaceAccessOptions {
  workspaceId?: string;
  cookieAdapter?: CookieAdapter;
  requiredRole?: "owner" | "admin" | "member";
}

/**
 * Server-Side Workspace Authorization Guard.
 *
 * CRITICAL SECURITY & TENANT ISOLATION RULES:
 * 1. Derives authenticated user identity exclusively from getServerAuthContext().
 * 2. If workspaceId parameter is provided, explicitly verifies active membership in workspace_members.
 * 3. NEVER trusts workspaceId from client request headers, bodies, or URLs without DB verification.
 * 4. Returns authorized workspace context containing { authUser, userId, appUser, workspace, workspaceId, memberRole }.
 */
export async function requireWorkspaceAccess(
  options: RequireWorkspaceAccessOptions = {},
): Promise<AuthorizedWorkspaceContext> {
  // Browser execution guard
  if (typeof window !== "undefined") {
    throw new WorkspaceAccessError(
      "UNAUTHORIZED_WORKSPACE",
      "[SILEX Security Guard] requireWorkspaceAccess was invoked in client browser context. Authorization must execute on the server.",
    );
  }

  // 1. Authenticate user via Server Auth Context
  const authContext = await getServerAuthContext(options.cookieAdapter);
  const { userId } = authContext;

  if (!db) {
    throw new WorkspaceAccessError(
      "DATABASE_ERROR",
      "Database connection handle is uninitialized.",
    );
  }

  try {
    // 2. If explicit workspaceId was passed, verify active membership
    if (options.workspaceId) {
      const memberships = await db
        .select({
          workspace: workspaces,
          member: workspaceMembers,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(
          and(
            eq(workspaceMembers.userId, userId),
            eq(workspaceMembers.workspaceId, options.workspaceId),
            eq(workspaceMembers.status, "active"),
            isNull(workspaces.deletedAt),
          ),
        )
        .limit(1);

      if (memberships.length === 0) {
        throw new WorkspaceAccessError(
          "UNAUTHORIZED_WORKSPACE",
          `Access denied. Authenticated user does not possess active membership in workspace '${options.workspaceId}'.`,
        );
      }

      const { workspace, member } = memberships[0];

      if (options.requiredRole) {
        const roleHierarchy: Record<string, number> = {
          member: 1,
          admin: 2,
          owner: 3,
        };
        const userRoleLevel = roleHierarchy[member.role] || 1;
        const requiredRoleLevel = roleHierarchy[options.requiredRole] || 1;

        if (userRoleLevel < requiredRoleLevel) {
          throw new WorkspaceAccessError(
            "UNAUTHORIZED_WORKSPACE",
            `Permission denied. Required role level '${options.requiredRole}', but user possesses '${member.role}'.`,
          );
        }
      }

      return {
        ...authContext,
        workspace,
        workspaceId: workspace.id,
        memberRole: member.role,
      };
    }

    // 3. If no workspaceId was passed, resolve user's primary/first active workspace
    const userWorkspaces = await db
      .select({
        workspace: workspaces,
        member: workspaceMembers,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, "active"),
          isNull(workspaces.deletedAt),
        ),
      )
      .limit(1);

    if (userWorkspaces.length > 0) {
      const { workspace, member } = userWorkspaces[0];
      return {
        ...authContext,
        workspace,
        workspaceId: workspace.id,
        memberRole: member.role,
      };
    }

    // 4. Fallback Auto-Provisioning: If user has no workspace yet, create a default workspace
    const rawName = authContext.appUser.fullName || "My";
    const workspaceName = rawName.toLowerCase().endsWith("s")
      ? `${rawName}' Workspace`
      : `${rawName}'s Workspace`;

    const baseSlug = rawName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "workspace";
    const slug = `${baseSlug}-${userId.slice(0, 8)}`;

    const [newWorkspace] = await db
      .insert(workspaces)
      .values({
        name: workspaceName,
        slug: slug,
        ownerId: userId,
        planTier: "free",
        isActive: true,
      })
      .returning();

    const [newMember] = await db
      .insert(workspaceMembers)
      .values({
        workspaceId: newWorkspace.id,
        userId: userId,
        role: "owner",
        status: "active",
      })
      .returning();

    return {
      ...authContext,
      workspace: newWorkspace,
      workspaceId: newWorkspace.id,
      memberRole: newMember.role,
    };
  } catch (err) {
    if (err instanceof WorkspaceAccessError || err instanceof AuthContextError) throw err;
    throw new WorkspaceAccessError(
      "DATABASE_ERROR",
      "An unexpected database error occurred during workspace authorization.",
      err,
    );
  }
}
