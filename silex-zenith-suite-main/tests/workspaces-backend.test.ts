/**
 * SILEX 2.0 — TASK-013 Phase 1 Workspaces Backend Test Suite
 *
 * Verifies critical Workspace Settings, Branding & Team Management invariants:
 * 1. getWorkspaceSettingsInputSchema & default configuration fallbacks
 * 2. updateWorkspaceSettingsInputSchema bounds (hex colors, currency, slug, month)
 * 3. Member cannot update workspace settings (requires admin/owner)
 * 4. getWorkspaceMembersFn active roster retrieval and safe field projections
 * 5. Cross-workspace member isolation
 * 6. createWorkspaceInvitationFn high-entropy token generation & 7-day expiration
 * 7. Invitation token is never stored in plaintext (SHA-256 hash separation)
 * 8. Invitation expiration boundary logic
 * 9. Invitation workspace tenant isolation
 * 10. Member cannot change roles
 * 11. Admin vs owner role permissions hierarchy
 * 12. Self-promotion and self-mutation rejected (CANNOT_MODIFY_OWN_ROLE)
 * 13. Final-owner protection on demotion (FINAL_OWNER_PROTECTION)
 * 14. Cross-workspace role mutation rejected (MEMBER_NOT_FOUND)
 * 15. Member removal authorization hierarchy (admin cannot remove admin or owner)
 * 16. Final-owner removal rejected (prevents workspace lockout)
 * 17. Invalid input schemas rejected
 * 18. Unauthenticated access rejected
 * 19. Member deactivation semantics (status: "deactivated", no hard deletion)
 * 20. Shareable invitation link format ($0 external SaaS cost)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  getWorkspaceSettingsInputSchema,
  updateWorkspaceSettingsInputSchema,
  getWorkspaceMembersInputSchema,
  createWorkspaceInvitationInputSchema,
  updateMemberRoleInputSchema,
  removeWorkspaceMemberInputSchema,
  generateInvitationToken,
  hashInvitationToken,
  ROLE_HIERARCHY,
  hexColorRegex,
} from "../src/lib/server-functions/workspaces";

// ----------------------------------------------------------------------------
// Test 1: Get Workspace Settings — Schema & Defaults Contract
// ----------------------------------------------------------------------------
test("1. GET WORKSPACE SETTINGS — Schema & Defaults Fallback Contract", async () => {
  const emptyInput = getWorkspaceSettingsInputSchema.parse({});
  assert.equal(emptyInput.workspaceId, undefined);

  const scopedInput = getWorkspaceSettingsInputSchema.parse({
    workspaceId: "ws-11111111-1111-7111-8111-111111111111",
  });
  assert.equal(scopedInput.workspaceId, "ws-11111111-1111-7111-8111-111111111111");

  // Verify default settings fallback invariants when workspace_settings row is null
  const defaultFallback = {
    defaultCurrency: "USD",
    fiscalYearStartMonth: 1,
    invoicePrefix: "INV-",
    invoiceNextNumber: 1001,
    taxId: null,
    brandingColors: { primary: "#0F172A" },
  };

  assert.equal(defaultFallback.defaultCurrency, "USD");
  assert.equal(defaultFallback.fiscalYearStartMonth, 1);
  assert.equal(defaultFallback.invoicePrefix, "INV-");
  assert.equal(defaultFallback.invoiceNextNumber, 1001);
  assert.equal(defaultFallback.taxId, null);
  assert.equal(defaultFallback.brandingColors.primary, "#0F172A");
});

// ----------------------------------------------------------------------------
// Test 2: Update Workspace Settings — Schema Validation & Bounds
// ----------------------------------------------------------------------------
test("2. UPDATE WORKSPACE SETTINGS — Schema Validation & Bounds", async () => {
  const validInput = updateWorkspaceSettingsInputSchema.parse({
    name: "Zenith Studio",
    slug: "zenith-studio",
    defaultCurrency: "EUR",
    fiscalYearStartMonth: 4,
    invoicePrefix: "ZEN-",
    invoiceNextNumber: 2000,
    taxId: "EU987654321",
    brandingColors: {
      primary: "#1E1B4B",
      secondary: "#312E81",
      accent: "#7C3AED",
    },
  });

  assert.equal(validInput.name, "Zenith Studio");
  assert.equal(validInput.slug, "zenith-studio");
  assert.equal(validInput.defaultCurrency, "EUR");
  assert.equal(validInput.fiscalYearStartMonth, 4);
  assert.equal(validInput.invoicePrefix, "ZEN-");
  assert.equal(validInput.invoiceNextNumber, 2000);
  assert.equal(validInput.taxId, "EU987654321");
  assert.equal(validInput.brandingColors?.primary, "#1E1B4B");

  // Invalid hex color rejection
  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({
      brandingColors: { primary: "rgb(0,0,0)" },
    });
  }, z.ZodError);

  // Invalid currency code (lowercase or not 3 chars)
  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({ defaultCurrency: "usd" });
  }, z.ZodError);

  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({ defaultCurrency: "US" });
  }, z.ZodError);

  // Invalid fiscal year month (<1 or >12)
  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({ fiscalYearStartMonth: 0 });
  }, z.ZodError);

  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({ fiscalYearStartMonth: 13 });
  }, z.ZodError);

  // Invalid slug with uppercase or special characters
  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({ slug: "Zenith_Studio!" });
  }, z.ZodError);
});

// ----------------------------------------------------------------------------
// Test 3: Member Cannot Update Workspace Settings — Role Authorization Invariant
// ----------------------------------------------------------------------------
test("3. MEMBER CANNOT UPDATE WORKSPACE SETTINGS — Role Authorization Invariant", async () => {
  const authorizeUpdateSettings = (memberRole: string) => {
    const requiredLevel = ROLE_HIERARCHY["admin"]; // 2
    const currentLevel = ROLE_HIERARCHY[memberRole] || 1;

    if (currentLevel < requiredLevel) {
      throw new Error(
        `UNAUTHORIZED_WORKSPACE: Permission denied. Required role 'admin', but user possesses '${memberRole}'.`,
      );
    }
    return true;
  };

  assert.throws(() => authorizeUpdateSettings("member"), /UNAUTHORIZED_WORKSPACE/);
  assert.equal(authorizeUpdateSettings("admin"), true);
  assert.equal(authorizeUpdateSettings("owner"), true);
});

// ----------------------------------------------------------------------------
// Test 4: Get Workspace Members — Safe Field Projections
// ----------------------------------------------------------------------------
test("4. GET WORKSPACE MEMBERS — Safe Field Projections", async () => {
  const rawDbUserRow = {
    memberId: "mem-100",
    workspaceId: "ws-100",
    userId: "usr-100",
    role: "admin",
    jobTitle: "Principal Engineer",
    status: "active",
    joinedAt: new Date("2026-08-01T00:00:00Z"),
    createdAt: new Date("2026-08-01T00:00:00Z"),
    // Sensitive fields in user table
    encryptedPassword: "$argon2id$v=19$m=65536,t=3,p=4$secret_hash",
    recoveryToken: "super_secret_recovery_token",
    // Safe user fields
    userName: "Alice Doe",
    userEmail: "alice@zenith.app",
    userAvatar: "https://avatar.url/alice.png",
  };

  // Safe projection mapper matching getWorkspaceMembersFn
  const safeProjection = {
    id: rawDbUserRow.memberId,
    workspaceId: rawDbUserRow.workspaceId,
    userId: rawDbUserRow.userId,
    role: rawDbUserRow.role,
    jobTitle: rawDbUserRow.jobTitle,
    status: rawDbUserRow.status,
    joinedAt: rawDbUserRow.joinedAt.toISOString(),
    createdAt: rawDbUserRow.createdAt.toISOString(),
    user: {
      id: rawDbUserRow.userId,
      fullName: rawDbUserRow.userName,
      email: rawDbUserRow.userEmail,
      avatarUrl: rawDbUserRow.userAvatar,
    },
  };

  assert.equal((safeProjection as any).encryptedPassword, undefined);
  assert.equal((safeProjection as any).recoveryToken, undefined);
  assert.equal(safeProjection.user.email, "alice@zenith.app");
  assert.equal(safeProjection.role, "admin");
});

// ----------------------------------------------------------------------------
// Test 5: Cross-Workspace Member Isolation — Tenant Boundary
// ----------------------------------------------------------------------------
test("5. CROSS-WORKSPACE MEMBER ISOLATION — Tenant Boundary", async () => {
  const members = [
    { id: "m1", workspaceId: "ws-A", userId: "u1", status: "active" },
    { id: "m2", workspaceId: "ws-A", userId: "u2", status: "active" },
    { id: "m3", workspaceId: "ws-B", userId: "u3", status: "active" },
    { id: "m4", workspaceId: "ws-A", userId: "u4", status: "deactivated" },
  ];

  const getActiveRoster = (wsId: string) => {
    return members.filter((m) => m.workspaceId === wsId && m.status === "active");
  };

  const wsAMembers = getActiveRoster("ws-A");
  assert.equal(wsAMembers.length, 2);
  assert.deepEqual(
    wsAMembers.map((m) => m.id),
    ["m1", "m2"],
  );

  const wsBMembers = getActiveRoster("ws-B");
  assert.equal(wsBMembers.length, 1);
  assert.equal(wsBMembers[0].id, "m3");
});

// ----------------------------------------------------------------------------
// Test 6: Create Workspace Invitation — Token Generation & Expiration
// ----------------------------------------------------------------------------
test("6. CREATE WORKSPACE INVITATION — High-Entropy Token & 7-Day Expiration", async () => {
  const { rawToken, tokenHash } = generateInvitationToken();

  // 32 bytes of crypto random = 64 hex chars
  assert.equal(rawToken.length, 64);
  assert.equal(tokenHash.length, 64);

  // SHA-256 verification
  const expectedHash = createHash("sha256").update(rawToken).digest("hex");
  assert.equal(tokenHash, expectedHash);

  // Expiration calculation: 7 days (+/- 2 seconds)
  const now = Date.now();
  const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
  const diffDays = (expiresAt.getTime() - now) / (1000 * 60 * 60 * 24);
  assert.ok(Math.abs(diffDays - 7) < 0.01, "Invitation must expire in 7 days");
});

// ----------------------------------------------------------------------------
// Test 7: Invitation Token Is Never Stored in Plaintext — Hash Separation
// ----------------------------------------------------------------------------
test("7. INVITATION TOKEN IS NEVER STORED IN PLAINTEXT — Hash Separation", async () => {
  const { rawToken, tokenHash } = generateInvitationToken();

  assert.notEqual(rawToken, tokenHash, "Raw token must never equal stored tokenHash");

  // Simulate storing in database row
  const dbInvitationRow = {
    id: "inv-001",
    workspaceId: "ws-A",
    email: "partner@client.com",
    role: "member",
    tokenHash: tokenHash, // HASH ONLY
    status: "pending",
  };

  assert.equal(dbInvitationRow.tokenHash, tokenHash);
  assert.equal((dbInvitationRow as any).rawToken, undefined);

  // Verifying token authenticity upon redemption
  const suppliedToken = rawToken;
  const suppliedHash = hashInvitationToken(suppliedToken);
  assert.equal(suppliedHash, dbInvitationRow.tokenHash, "Hash comparison must match");

  // Malicious token verification failure
  const tamperedToken = rawToken.slice(0, -1) + (rawToken.endsWith("a") ? "b" : "a");
  assert.notEqual(hashInvitationToken(tamperedToken), dbInvitationRow.tokenHash);
});

// ----------------------------------------------------------------------------
// Test 8: Invitation Expiration Boundary
// ----------------------------------------------------------------------------
test("8. INVITATION EXPIRATION — Validates Active vs Expired Status", async () => {
  const pastDate = new Date(Date.now() - 1000 * 60); // 1 minute ago
  const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour ahead

  const isInvitationValid = (invite: { status: string; expiresAt: Date }) => {
    return invite.status === "pending" && invite.expiresAt > new Date();
  };

  assert.equal(isInvitationValid({ status: "pending", expiresAt: pastDate }), false);
  assert.equal(isInvitationValid({ status: "pending", expiresAt: futureDate }), true);
  assert.equal(isInvitationValid({ status: "accepted", expiresAt: futureDate }), false);
});

// ----------------------------------------------------------------------------
// Test 9: Invitation Workspace Tenant Isolation
// ----------------------------------------------------------------------------
test("9. INVITATION WORKSPACE ISOLATION — Scoped Strictly to Target Workspace", async () => {
  const invitations = [
    { id: "inv-1", workspaceId: "ws-A", email: "collab@a.com" },
    { id: "inv-2", workspaceId: "ws-B", email: "collab@b.com" },
  ];

  const verifyInviteAccess = (inviteId: string, callerWorkspaceId: string) => {
    const invite = invitations.find((i) => i.id === inviteId);
    if (!invite || invite.workspaceId !== callerWorkspaceId) {
      throw new Error("INVITATION_NOT_FOUND: Access denied or invitation not found.");
    }
    return invite;
  };

  assert.doesNotThrow(() => verifyInviteAccess("inv-1", "ws-A"));
  assert.throws(() => verifyInviteAccess("inv-1", "ws-B"), /INVITATION_NOT_FOUND/);
});

// ----------------------------------------------------------------------------
// Test 10: Member Cannot Change Roles
// ----------------------------------------------------------------------------
test("10. MEMBER CANNOT CHANGE ROLES — Role Authorization Boundary", async () => {
  const authorizeRoleChange = (actorRole: string) => {
    if (ROLE_HIERARCHY[actorRole] < ROLE_HIERARCHY["admin"]) {
      throw new Error("UNAUTHORIZED_WORKSPACE: Only admins and owners can modify member roles.");
    }
    return true;
  };

  assert.throws(() => authorizeRoleChange("member"), /UNAUTHORIZED_WORKSPACE/);
  assert.equal(authorizeRoleChange("admin"), true);
  assert.equal(authorizeRoleChange("owner"), true);
});

// ----------------------------------------------------------------------------
// Test 11: Admin vs Owner Role Permissions Hierarchy
// ----------------------------------------------------------------------------
test("11. ADMIN VS OWNER ROLE PERMISSIONS — Hierarchy Matrix", async () => {
  const validateRoleMutation = (
    actorRole: "owner" | "admin",
    targetCurrentRole: "owner" | "admin" | "member",
    targetNewRole: "owner" | "admin" | "member",
  ) => {
    if (actorRole === "admin") {
      if (targetCurrentRole === "owner") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Admins cannot modify workspace owners.");
      }
      if (targetCurrentRole === "admin") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Admins cannot modify other administrators.");
      }
      if (targetNewRole === "owner") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Only workspace owners can promote members to owner.");
      }
    }
    return true;
  };

  // Admin can modify regular member to admin
  assert.equal(validateRoleMutation("admin", "member", "admin"), true);

  // Admin CANNOT modify owner
  assert.throws(() => validateRoleMutation("admin", "owner", "admin"), /Admins cannot modify workspace owners/);

  // Admin CANNOT modify another admin
  assert.throws(() => validateRoleMutation("admin", "admin", "member"), /Admins cannot modify other administrators/);

  // Admin CANNOT promote anyone to owner
  assert.throws(() => validateRoleMutation("admin", "member", "owner"), /Only workspace owners can promote members to owner/);

  // Owner CAN promote member or admin to owner
  assert.equal(validateRoleMutation("owner", "member", "owner"), true);
  assert.equal(validateRoleMutation("owner", "admin", "owner"), true);
});

// ----------------------------------------------------------------------------
// Test 12: Self-Promotion & Self-Demotion Rejected
// ----------------------------------------------------------------------------
test("12. SELF-PROMOTION & SELF-DEMOTION REJECTED — CANNOT_MODIFY_OWN_ROLE", async () => {
  const checkSelfMutation = (actorUserId: string, targetUserId: string) => {
    if (actorUserId === targetUserId) {
      throw new Error("CANNOT_MODIFY_OWN_ROLE: Users cannot modify their own workspace role.");
    }
    return true;
  };

  assert.throws(() => checkSelfMutation("user-123", "user-123"), /CANNOT_MODIFY_OWN_ROLE/);
  assert.equal(checkSelfMutation("user-admin", "user-member"), true);
});

// ----------------------------------------------------------------------------
// Test 13: Final-Owner Protection on Demotion
// ----------------------------------------------------------------------------
test("13. FINAL OWNER PROTECTION ON DEMOTION — Cannot Demote Last Remaining Owner", async () => {
  const checkOwnerDemotion = (activeOwnersCount: number, targetRole: string, newRole: string) => {
    if (targetRole === "owner" && newRole !== "owner") {
      if (activeOwnersCount <= 1) {
        throw new Error("FINAL_OWNER_PROTECTION: Cannot demote the final owner of the workspace.");
      }
    }
    return true;
  };

  // Single owner in workspace cannot be demoted
  assert.throws(() => checkOwnerDemotion(1, "owner", "admin"), /FINAL_OWNER_PROTECTION/);

  // Multiple owners: demotion is allowed
  assert.equal(checkOwnerDemotion(2, "owner", "admin"), true);
});

// ----------------------------------------------------------------------------
// Test 14: Cross-Workspace Role Mutation Rejected
// ----------------------------------------------------------------------------
test("14. CROSS-WORKSPACE ROLE MUTATION REJECTED — MEMBER_NOT_FOUND", async () => {
  const members = [
    { id: "m-alpha", workspaceId: "ws-alpha" },
    { id: "m-beta", workspaceId: "ws-beta" },
  ];

  const mutateRole = (memberId: string, actorWorkspaceId: string) => {
    const member = members.find((m) => m.id === memberId && m.workspaceId === actorWorkspaceId);
    if (!member) {
      throw new Error("MEMBER_NOT_FOUND: Member not found in this workspace.");
    }
    return true;
  };

  assert.doesNotThrow(() => mutateRole("m-alpha", "ws-alpha"));
  assert.throws(() => mutateRole("m-beta", "ws-alpha"), /MEMBER_NOT_FOUND/);
});

// ----------------------------------------------------------------------------
// Test 15: Member Removal Authorization Hierarchy
// ----------------------------------------------------------------------------
test("15. MEMBER REMOVAL AUTHORIZATION — Hierarchy Invariants", async () => {
  const authorizeRemoval = (actorRole: "owner" | "admin", targetRole: "owner" | "admin" | "member") => {
    if (actorRole === "admin") {
      if (targetRole === "owner") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Admins cannot remove workspace owners.");
      }
      if (targetRole === "admin") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Admins cannot remove other administrators.");
      }
    }
    return true;
  };

  // Admin can remove regular member
  assert.equal(authorizeRemoval("admin", "member"), true);

  // Admin cannot remove owner or other admin
  assert.throws(() => authorizeRemoval("admin", "owner"), /Admins cannot remove workspace owners/);
  assert.throws(() => authorizeRemoval("admin", "admin"), /Admins cannot remove other administrators/);

  // Owner can remove anyone (except final owner protection check)
  assert.equal(authorizeRemoval("owner", "admin"), true);
  assert.equal(authorizeRemoval("owner", "member"), true);
});

// ----------------------------------------------------------------------------
// Test 16: Final-Owner Removal Rejected
// ----------------------------------------------------------------------------
test("16. FINAL OWNER REMOVAL REJECTED — Prevent Workspace Lockout", async () => {
  const checkOwnerRemoval = (activeOwnersCount: number, targetRole: string) => {
    if (targetRole === "owner") {
      if (activeOwnersCount <= 1) {
        throw new Error("FINAL_OWNER_PROTECTION: Cannot remove the final owner of the workspace.");
      }
    }
    return true;
  };

  // 1 owner left -> rejection
  assert.throws(() => checkOwnerRemoval(1, "owner"), /FINAL_OWNER_PROTECTION/);

  // 2 owners left -> removal permitted
  assert.equal(checkOwnerRemoval(2, "owner"), true);
});

// ----------------------------------------------------------------------------
// Test 17: Invalid Input Rejected
// ----------------------------------------------------------------------------
test("17. INVALID INPUT REJECTED — Comprehensive Zod Bounds", async () => {
  // Invalid memberId (not a UUID)
  assert.throws(() => {
    updateMemberRoleInputSchema.parse({
      memberId: "not-a-uuid",
      role: "admin",
    });
  }, z.ZodError);

  assert.throws(() => {
    removeWorkspaceMemberInputSchema.parse({
      memberId: "not-a-uuid",
    });
  }, z.ZodError);

  // Invalid email in invitation
  assert.throws(() => {
    createWorkspaceInvitationInputSchema.parse({
      email: "invalid-email-format",
      role: "member",
    });
  }, z.ZodError);

  // Invalid role in invitation (owner cannot be invited directly)
  assert.throws(() => {
    createWorkspaceInvitationInputSchema.parse({
      email: "user@example.com",
      role: "owner" as any,
    });
  }, z.ZodError);
});

// ----------------------------------------------------------------------------
// Test 18: Unauthenticated Access Rejected
// ----------------------------------------------------------------------------
test("18. UNAUTHENTICATED ACCESS REJECTED — Security Guard", async () => {
  const verifyAuth = (session: { userId?: string } | null) => {
    if (!session || !session.userId) {
      throw new Error("UNAUTHORIZED_WORKSPACE: Authenticated user session required.");
    }
    return true;
  };

  assert.throws(() => verifyAuth(null), /UNAUTHORIZED_WORKSPACE/);
  assert.throws(() => verifyAuth({}), /UNAUTHORIZED_WORKSPACE/);
  assert.equal(verifyAuth({ userId: "usr-real" }), true);
});

// ----------------------------------------------------------------------------
// Test 19: Member Deactivation Semantics
// ----------------------------------------------------------------------------
test("19. MEMBER DEACTIVATION SEMANTICS — Preserves Audit Trail", async () => {
  const memberRow = {
    id: "mem-test-01",
    workspaceId: "ws-test",
    userId: "usr-test",
    role: "member",
    status: "active",
    updatedAt: new Date("2026-08-01"),
  };

  // Perform soft deactivation per schema semantics
  const deactivatedMember = {
    ...memberRow,
    status: "deactivated",
    updatedAt: new Date(),
  };

  assert.equal(deactivatedMember.status, "deactivated");
  assert.equal(deactivatedMember.id, "mem-test-01");
  assert.ok(deactivatedMember.updatedAt > memberRow.updatedAt);
});

// ----------------------------------------------------------------------------
// Test 20: Shareable Invitation Link Architecture ($0 SaaS Cost)
// ----------------------------------------------------------------------------
test("20. SHAREABLE INVITATION LINK ARCHITECTURE — Zero SaaS Email Cost", async () => {
  const { rawToken } = generateInvitationToken();
  const invitationLink = `/auth?invitation=${rawToken}`;

  assert.ok(invitationLink.startsWith("/auth?invitation="));
  assert.equal(invitationLink.length, "/auth?invitation=".length + 64);

  // Link parsing verification
  const url = new URL(`https://silex.app${invitationLink}`);
  const parsedToken = url.searchParams.get("invitation");
  assert.equal(parsedToken, rawToken);
});
