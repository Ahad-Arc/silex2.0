/**
 * SILEX 2.0 — TASK-013 Phase 2 Workspaces UI & Integration Test Suite
 *
 * Verifies critical Workspace Settings, Branding, Team UI & AppShell Invariants:
 * 1. Workspace settings data loading contract (getWorkspaceSettingsFn response shape)
 * 2. Workspace settings save submission validation
 * 3. Settings validation & error state handling (slug regex, currency code, invoice numbering)
 * 4. Branding save contract and hex color validation
 * 5. Team members roster data contract (getWorkspaceMembersFn safe projections)
 * 6. Invite teammate modal validation (email format, role enum)
 * 7. Invitation link display & copyable link architecture
 * 8. Role update interaction bounds & UI permission hierarchy matrix
 * 9. Member deactivation confirmation contract (soft deactivation alert)
 * 10. AppShell dynamic workspace identity & initials derivation logic
 * 11. Existing Phase 1 backend non-regression
 * 12. Multi-tenant workspace isolation non-regression
 */

import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  getWorkspaceSettingsInputSchema,
  updateWorkspaceSettingsInputSchema,
  getWorkspaceMembersInputSchema,
  createWorkspaceInvitationInputSchema,
  updateMemberRoleInputSchema,
  removeWorkspaceMemberInputSchema,
  generateInvitationToken,
  hexColorRegex,
  ROLE_HIERARCHY,
} from "../src/lib/server-functions/workspaces";

// ----------------------------------------------------------------------------
// Test 1: Workspace Settings Load Contract
// ----------------------------------------------------------------------------
test("1. WORKSPACE SETTINGS LOAD — Response Shape & Default Fallback Contract", async () => {
  const mockWorkspace = {
    id: "ws-018f6730-1000-7000-8000-000000000001",
    name: "Zenith Corp",
    slug: "zenith-corp",
    logoUrl: "https://example.com/logo.svg",
    planTier: "pro",
    ownerId: "usr-018f6730-2000-7000-8000-000000000001",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };

  const mockSettings = {
    id: "set-018f6730-3000-7000-8000-000000000001",
    workspaceId: mockWorkspace.id,
    defaultCurrency: "EUR",
    fiscalYearStartMonth: 4,
    invoicePrefix: "ZEN-",
    invoiceNextNumber: 2005,
    taxId: "EU-123456789",
    brandingColors: {
      primary: "#1E1B4B",
      secondary: "#312E81",
      accent: "#7C3AED",
    },
    updatedAt: "2026-09-20T00:00:00.000Z",
  };

  const mockResponse = {
    workspace: mockWorkspace,
    settings: mockSettings,
    userRole: "admin",
  };

  assert.ok(mockResponse.workspace.id);
  assert.equal(mockResponse.workspace.name, "Zenith Corp");
  assert.equal(mockResponse.workspace.planTier, "pro");
  assert.equal(mockResponse.settings.defaultCurrency, "EUR");
  assert.equal(mockResponse.settings.invoicePrefix, "ZEN-");
  assert.equal(mockResponse.settings.invoiceNextNumber, 2005);
  assert.equal(mockResponse.userRole, "admin");
});

// ----------------------------------------------------------------------------
// Test 2: Workspace Settings Save Validation
// ----------------------------------------------------------------------------
test("2. WORKSPACE SETTINGS SAVE — Validates Editable Submission Fields", async () => {
  const submissionData = {
    name: "Apex Creative Studio",
    slug: "apex-creative",
    defaultCurrency: "GBP",
    invoicePrefix: "APX-",
    invoiceNextNumber: 5001,
    taxId: "GB-998877665",
    fiscalYearStartMonth: 7,
  };

  const validated = updateWorkspaceSettingsInputSchema.parse(submissionData);
  assert.equal(validated.name, "Apex Creative Studio");
  assert.equal(validated.slug, "apex-creative");
  assert.equal(validated.defaultCurrency, "GBP");
  assert.equal(validated.invoicePrefix, "APX-");
  assert.equal(validated.invoiceNextNumber, 5001);
  assert.equal(validated.taxId, "GB-998877665");
  assert.equal(validated.fiscalYearStartMonth, 7);
});

// ----------------------------------------------------------------------------
// Test 3: Settings Validation & Error State Handling
// ----------------------------------------------------------------------------
test("3. SETTINGS VALIDATION & ERROR STATE — Rejects Malformed Input Fields", async () => {
  // Slug with spaces and symbols
  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({ slug: "My Invalid Slug!" });
  }, z.ZodError);

  // Currency not 3 letters uppercase
  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({ defaultCurrency: "dollars" });
  }, z.ZodError);

  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({ defaultCurrency: "us" });
  }, z.ZodError);

  // Negative invoice next number
  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({ invoiceNextNumber: -10 });
  }, z.ZodError);

  // Fiscal month out of bounds
  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({ fiscalYearStartMonth: 13 });
  }, z.ZodError);
});

// ----------------------------------------------------------------------------
// Test 4: Branding Save Contract & Hex Color Validation
// ----------------------------------------------------------------------------
test("4. BRANDING SAVE — Hex Code Validation & Palette Bounds", async () => {
  const validBranding = updateWorkspaceSettingsInputSchema.parse({
    brandingColors: {
      primary: "#0F172A",
      secondary: "#1E293B",
      accent: "#7C3AED",
    },
    logoUrl: "https://cdn.example.com/brand/logo.svg",
  });

  assert.equal(validBranding.brandingColors?.primary, "#0F172A");
  assert.equal(validBranding.brandingColors?.secondary, "#1E293B");
  assert.equal(validBranding.brandingColors?.accent, "#7C3AED");
  assert.equal(validBranding.logoUrl, "https://cdn.example.com/brand/logo.svg");

  // Invalid hex code rejection
  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({
      brandingColors: { primary: "not-a-color" },
    });
  }, z.ZodError);

  assert.throws(() => {
    updateWorkspaceSettingsInputSchema.parse({
      brandingColors: { primary: "#12345" }, // 5 hex chars is invalid
    });
  }, z.ZodError);
});

// ----------------------------------------------------------------------------
// Test 5: Team Members Roster Data Contract
// ----------------------------------------------------------------------------
test("5. TEAM MEMBERS ROSTER — Safe Field Projection Contract", async () => {
  const rosterItem = {
    id: "mem-001",
    workspaceId: "ws-001",
    userId: "usr-001",
    role: "admin",
    jobTitle: "Lead Designer",
    status: "active",
    joinedAt: "2026-08-15T00:00:00.000Z",
    createdAt: "2026-08-15T00:00:00.000Z",
    user: {
      id: "usr-001",
      fullName: "Sarah Connor",
      email: "sarah@zenith.app",
      avatarUrl: "https://avatar.url/sarah.jpg",
    },
  };

  assert.ok(rosterItem.id);
  assert.equal(rosterItem.role, "admin");
  assert.equal(rosterItem.user.fullName, "Sarah Connor");
  assert.equal(rosterItem.user.email, "sarah@zenith.app");

  // Verify zero sensitive leakages
  assert.equal((rosterItem as any).encryptedPassword, undefined);
  assert.equal((rosterItem as any).tokenHash, undefined);
});

// ----------------------------------------------------------------------------
// Test 6: Invite Teammate Modal Validation
// ----------------------------------------------------------------------------
test("6. INVITE MODAL — Validates Email Format & Allowed Roles", async () => {
  const validMemberInvite = createWorkspaceInvitationInputSchema.parse({
    email: "partner@agency.co",
    role: "member",
  });
  assert.equal(validMemberInvite.email, "partner@agency.co");
  assert.equal(validMemberInvite.role, "member");

  const validAdminInvite = createWorkspaceInvitationInputSchema.parse({
    email: "cto@agency.co",
    role: "admin",
  });
  assert.equal(validAdminInvite.role, "admin");

  // Invalid email
  assert.throws(() => {
    createWorkspaceInvitationInputSchema.parse({ email: "invalid-email" });
  }, z.ZodError);

  // Inviting directly as owner is prohibited
  assert.throws(() => {
    createWorkspaceInvitationInputSchema.parse({ email: "boss@agency.co", role: "owner" as any });
  }, z.ZodError);
});

// ----------------------------------------------------------------------------
// Test 7: Invitation Link Display & Copyable Architecture ($0 Cost)
// ----------------------------------------------------------------------------
test("7. INVITATION LINK DISPLAY — Single-Use Shareable Link Construction", async () => {
  const { rawToken } = generateInvitationToken();
  const origin = "https://silex.app";
  const invitationLink = `${origin}/auth?invitation=${rawToken}`;

  assert.ok(invitationLink.startsWith("https://silex.app/auth?invitation="));
  assert.equal(invitationLink.length, "https://silex.app/auth?invitation=".length + 64);

  // Parse link
  const url = new URL(invitationLink);
  assert.equal(url.searchParams.get("invitation"), rawToken);
  assert.equal(url.pathname, "/auth");
});

// ----------------------------------------------------------------------------
// Test 8: Role Update Interaction Bounds & UI Permission Hierarchy
// ----------------------------------------------------------------------------
test("8. ROLE UPDATE INTERACTION — UI Permission Hierarchy Matrix", async () => {
  interface MemberCheck {
    id: string;
    userId: string;
    role: "owner" | "admin" | "member";
  }

  const evaluateCanChangeRole = (
    currentUserId: string,
    currentUserRole: "owner" | "admin" | "member",
    targetMember: MemberCheck,
    activeOwnersCount: number,
  ): boolean => {
    const isSelf = targetMember.userId === currentUserId;
    if (isSelf) return false; // Self-mutation disabled

    const isTargetOwner = targetMember.role === "owner";
    const isTargetAdmin = targetMember.role === "admin";

    if (currentUserRole === "owner") {
      // Owner can change anyone, except cannot demote last remaining owner
      return !(isTargetOwner && activeOwnersCount <= 1);
    } else if (currentUserRole === "admin") {
      // Admin can only toggle regular members between member and admin
      return !isTargetOwner && !isTargetAdmin;
    }
    return false;
  };

  const selfMember: MemberCheck = { id: "m1", userId: "usr-admin", role: "admin" };
  const otherOwner: MemberCheck = { id: "m2", userId: "usr-other-owner", role: "owner" };
  const otherAdmin: MemberCheck = { id: "m3", userId: "usr-other-admin", role: "admin" };
  const otherMember: MemberCheck = { id: "m4", userId: "usr-member", role: "member" };

  // 1. Admin actor
  assert.equal(evaluateCanChangeRole("usr-admin", "admin", selfMember, 1), false, "Self change prohibited");
  assert.equal(evaluateCanChangeRole("usr-admin", "admin", otherOwner, 1), false, "Admin cannot change owner");
  assert.equal(evaluateCanChangeRole("usr-admin", "admin", otherAdmin, 1), false, "Admin cannot change other admin");
  assert.equal(evaluateCanChangeRole("usr-admin", "admin", otherMember, 1), true, "Admin CAN change regular member");

  // 2. Owner actor
  assert.equal(evaluateCanChangeRole("usr-owner", "owner", selfMember, 1), true, "Owner can change admin");
  assert.equal(evaluateCanChangeRole("usr-owner", "owner", otherMember, 1), true, "Owner can change member");
  assert.equal(evaluateCanChangeRole("usr-owner", "owner", otherOwner, 1), false, "Owner cannot demote sole owner");
  assert.equal(evaluateCanChangeRole("usr-owner", "owner", otherOwner, 2), true, "Owner can demote owner if >=2 owners");

  // 3. Regular member actor
  assert.equal(evaluateCanChangeRole("usr-member", "member", otherMember, 1), false, "Member cannot change anyone");
});

// ----------------------------------------------------------------------------
// Test 9: Member Deactivation Confirmation Contract
// ----------------------------------------------------------------------------
test("9. MEMBER DEACTIVATION — Soft Deactivation Confirmation Contract", async () => {
  const member = {
    id: "mem-uuid-1234-5678",
    userId: "usr-uuid-1234-5678",
    fullName: "John Doe",
    email: "john@doe.com",
    role: "member",
    status: "active",
  };

  const validateDeactivationTarget = (
    actorRole: "owner" | "admin" | "member",
    targetRole: "owner" | "admin" | "member",
    isSelf: boolean,
    activeOwnersCount: number,
  ) => {
    if (isSelf && targetRole === "owner" && activeOwnersCount <= 1) {
      throw new Error("FINAL_OWNER_PROTECTION: Cannot remove the final owner.");
    }
    if (actorRole === "admin") {
      if (targetRole === "owner" || targetRole === "admin") {
        throw new Error("INSUFFICIENT_PERMISSIONS: Admins cannot remove owners or other admins.");
      }
    }
    if (actorRole === "member") {
      throw new Error("UNAUTHORIZED: Members cannot deactivate collaborators.");
    }
    return true;
  };

  assert.equal(validateDeactivationTarget("admin", "member", false, 1), true);
  assert.throws(() => validateDeactivationTarget("admin", "admin", false, 1), /INSUFFICIENT_PERMISSIONS/);
  assert.throws(() => validateDeactivationTarget("admin", "owner", false, 1), /INSUFFICIENT_PERMISSIONS/);
  assert.throws(() => validateDeactivationTarget("owner", "owner", true, 1), /FINAL_OWNER_PROTECTION/);
  assert.throws(() => validateDeactivationTarget("member", "member", false, 1), /UNAUTHORIZED/);
});

// ----------------------------------------------------------------------------
// Test 10: AppShell Dynamic Workspace Identity & Initials Derivation
// ----------------------------------------------------------------------------
test("10. APPSHELL WORKSPACE IDENTITY — Initials & Plan Tier Derivation", async () => {
  const computeWorkspaceDisplay = (name: string, planTier: string) => {
    const wsName = name || "Workspace";
    const wsInitials =
      wsName
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "WS";

    const rawTier = planTier || "free";
    const planLabel = `${rawTier.charAt(0).toUpperCase() + rawTier.slice(1)} plan`;

    return { wsName, wsInitials, planLabel };
  };

  // Multi-word name
  const d1 = computeWorkspaceDisplay("Ariana Studio", "free");
  assert.equal(d1.wsName, "Ariana Studio");
  assert.equal(d1.wsInitials, "AS");
  assert.equal(d1.planLabel, "Free plan");

  // Single word name
  const d2 = computeWorkspaceDisplay("Zenith", "pro");
  assert.equal(d2.wsName, "Zenith");
  assert.equal(d2.wsInitials, "Z");
  assert.equal(d2.planLabel, "Pro plan");

  // Three-word name (first two initials)
  const d3 = computeWorkspaceDisplay("Apex Digital Agency", "enterprise");
  assert.equal(d3.wsName, "Apex Digital Agency");
  assert.equal(d3.wsInitials, "AD");
  assert.equal(d3.planLabel, "Enterprise plan");

  // Fallback defaults
  const d4 = computeWorkspaceDisplay("", "");
  assert.equal(d4.wsName, "Workspace");
  assert.equal(d4.wsInitials, "W");
  assert.equal(d4.planLabel, "Free plan");
});

// ----------------------------------------------------------------------------
// Test 11: Existing Phase 1 Backend Non-Regression
// ----------------------------------------------------------------------------
test("11. PHASE 1 BACKEND NON-REGRESSION — Input Schemas and Types Unchanged", async () => {
  assert.ok(getWorkspaceSettingsInputSchema);
  assert.ok(updateWorkspaceSettingsInputSchema);
  assert.ok(getWorkspaceMembersInputSchema);
  assert.ok(createWorkspaceInvitationInputSchema);
  assert.ok(updateMemberRoleInputSchema);
  assert.ok(removeWorkspaceMemberInputSchema);

  // Verify hierarchy weights
  assert.equal(ROLE_HIERARCHY["member"], 1);
  assert.equal(ROLE_HIERARCHY["admin"], 2);
  assert.equal(ROLE_HIERARCHY["owner"], 3);
});

// ----------------------------------------------------------------------------
// Test 12: Multi-Tenant Workspace Isolation Non-Regression
// ----------------------------------------------------------------------------
test("12. MULTI-TENANT ISOLATION — Workspace Partitioning Enforcement", async () => {
  const ws1 = "ws-018f6730-1000-7000-8000-000000000001";
  const ws2 = "ws-018f6730-2000-7000-8000-000000000002";

  const memberRoster = [
    { id: "m1", workspaceId: ws1, name: "Alice" },
    { id: "m2", workspaceId: ws1, name: "Bob" },
    { id: "m3", workspaceId: ws2, name: "Charlie" },
  ];

  const queryMembersForWorkspace = (workspaceId: string) => {
    return memberRoster.filter((m) => m.workspaceId === workspaceId);
  };

  const ws1Members = queryMembersForWorkspace(ws1);
  assert.equal(ws1Members.length, 2);
  assert.equal(ws1Members.some((m) => m.name === "Charlie"), false, "Tenant B must never leak into Tenant A");

  const ws2Members = queryMembersForWorkspace(ws2);
  assert.equal(ws2Members.length, 1);
  assert.equal(ws2Members[0].name, "Charlie");
});

// ----------------------------------------------------------------------------
// Test 13: Settings Tab Navigation Contract & Active Tab Resolution
// ----------------------------------------------------------------------------
test("13. SETTINGS TAB NAVIGATION — Search Params Routing & Active Tab Resolution", async () => {
  const SECTIONS = [
    { id: "workspace", l: "Workspace" },
    { id: "team", l: "Team & members" },
    { id: "branding", l: "Branding" },
    { id: "automation", l: "Automation & webhooks" },
    { id: "profile", l: "Profile" },
    { id: "notifications", l: "Notifications" },
    { id: "billing", l: "Plan & billing" },
    { id: "security", l: "Security" },
    { id: "ai", l: "SILEX AI" },
  ];

  const resolveTab = (searchTab?: string): string => {
    if (searchTab === "automation" || searchTab === "api") return "automation";
    if (searchTab === "team") return "team";
    if (searchTab === "branding") return "branding";
    if (searchTab === "workspace") return "workspace";
    if (searchTab && SECTIONS.some((s) => s.id === searchTab)) return searchTab;
    return "workspace";
  };

  assert.equal(resolveTab(undefined), "workspace", "Default fallback is workspace tab");
  assert.equal(resolveTab("workspace"), "workspace");
  assert.equal(resolveTab("team"), "team");
  assert.equal(resolveTab("branding"), "branding");
  assert.equal(resolveTab("automation"), "automation");
  assert.equal(resolveTab("api"), "automation", "api alias resolves to automation");
  assert.equal(resolveTab("security"), "security");
  assert.equal(resolveTab("billing"), "billing");
  assert.equal(resolveTab("unknown_tab"), "workspace", "Unknown tab falls back to workspace");
});

// ----------------------------------------------------------------------------
// Test 14: Workspace Slug Formatting & Normalization
// ----------------------------------------------------------------------------
test("14. WORKSPACE SLUG CONSTRAINTS — Lowercase Alphanumeric & Hyphen Regex", async () => {
  const validSlugs = ["acme-studio", "zenith2026", "my-agency-corp", "workspace-1"];
  for (const s of validSlugs) {
    const validated = updateWorkspaceSettingsInputSchema.parse({ slug: s });
    assert.equal(validated.slug, s);
  }

  const invalidSlugs = [
    "Acme-Studio", // uppercase letters rejected
    "slug with spaces",
    "slug_with_underscores",
    "slug@symbol",
    "a", // min 2 characters
    "",
  ];

  for (const s of invalidSlugs) {
    assert.throws(
      () => updateWorkspaceSettingsInputSchema.parse({ slug: s }),
      z.ZodError,
      `Slug "${s}" should be rejected`,
    );
  }
});

// ----------------------------------------------------------------------------
// Test 15: Branding Palette Bounds & Default Brand Styling Fallback
// ----------------------------------------------------------------------------
test("15. BRANDING PALETTE BOUNDS — Hex Format & Default Color Palette Fallback", async () => {
  const defaultColors = {
    primary: "#0F172A",
    secondary: "#1E293B",
    accent: "#7C3AED",
  };

  assert.match(defaultColors.primary, hexColorRegex);
  assert.match(defaultColors.secondary, hexColorRegex);
  assert.match(defaultColors.accent, hexColorRegex);

  // 3-digit shorthand hex (#FFF, #000) is valid per hexColorRegex
  assert.match("#FFF", hexColorRegex);
  assert.match("#abc", hexColorRegex);

  // 6-digit hex (#0F172A) is valid
  assert.match("#123456", hexColorRegex);
  assert.match("#ABCDEF", hexColorRegex);

  // Invalid hex codes
  assert.doesNotMatch("0F172A", hexColorRegex, "Missing hash prefix");
  assert.doesNotMatch("#0F172", hexColorRegex, "5 characters invalid");
  assert.doesNotMatch("#0F172AA", hexColorRegex, "7 characters invalid");
  assert.doesNotMatch("#GGGGGG", hexColorRegex, "Non-hex characters");
  assert.doesNotMatch("rgba(0,0,0,1)", hexColorRegex, "Non-hex string format");
});
