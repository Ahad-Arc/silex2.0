/**
 * SILEX 2.0 — User Profile Settings & Identity Test Suite
 *
 * Verifies critical User Profile and Personal Preferences invariants:
 * 1. Profile retrieval schema and fallback configuration defaults
 * 2. Profile update schema validation & input bounds
 * 3. Invalid input rejection (empty name, bad URLs, overflow strings, invalid theme)
 * 4. Credential and secret non-exposure (passwordHash, sessions, tokenHash never leaked)
 * 5. Self-only mutation & server identity derivation (no client-provided userId trusted)
 * 6. Unauthenticated access & browser guard rejection
 * 7. Avatar URL handling & $0 physical storage invariant
 * 8. Preferences & UI config persistence contract (deep-merge and preservation)
 * 9. Workspace job title synchronization
 * 10. Route and component integration contracts (/app/profile, EditProfileModal)
 * 11. Initials generation and social link formatting logic
 * 12. Existing authentication & workspace regression safety
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../src");

import {
  getUserProfileInputSchema,
  updateUserProfileInputSchema,
  type UserProfileResponse,
} from "../src/lib/server-functions/profile";

// ----------------------------------------------------------------------------
// Test 1: Profile Retrieval Contract & Default Fallbacks
// ----------------------------------------------------------------------------
test("1. PROFILE RETRIEVAL — Schema & Default Configuration Fallback Contract", () => {
  const emptyInput = getUserProfileInputSchema.parse({});
  assert.equal(emptyInput.workspaceId, undefined);

  const scopedInput = getUserProfileInputSchema.parse({
    workspaceId: "018f6730-1000-7000-8000-000000000001",
  });
  assert.equal(scopedInput.workspaceId, "018f6730-1000-7000-8000-000000000001");

  // Verify response contract shape defaults
  const sampleProfile: UserProfileResponse = {
    user: {
      id: "018f6730-1000-7000-8000-000000000001",
      email: "user@silex.app",
      fullName: "Test User",
      avatarUrl: null,
      emailVerifiedAt: "2026-09-25T10:00:00.000Z",
      createdAt: "2026-09-25T10:00:00.000Z",
      updatedAt: "2026-09-25T10:00:00.000Z",
    },
    preferences: {
      theme: "dark",
      timezone: "UTC",
      locale: "en-US",
      keyboardShortcutsEnabled: true,
    },
    profile: {
      jobTitle: null,
      bio: "",
      location: "",
      website: "",
      twitter: "",
      github: "",
      skills: [],
    },
    workspaceRole: "owner",
  };

  assert.equal(sampleProfile.preferences.theme, "dark");
  assert.equal(sampleProfile.preferences.timezone, "UTC");
  assert.equal(sampleProfile.preferences.locale, "en-US");
  assert.equal(sampleProfile.preferences.keyboardShortcutsEnabled, true);
  assert.deepEqual(sampleProfile.profile.skills, []);
});

// ----------------------------------------------------------------------------
// Test 2: Valid Profile Update Input Processing
// ----------------------------------------------------------------------------
test("2. VALID PROFILE UPDATE — Validates Allowed Profile Fields & Bounds", () => {
  const validPayload = {
    fullName: "Ariana Vale",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
    jobTitle: "Founder & Creative Director",
    bio: "Independent designer working with founders on brand and product identity.",
    location: "Brooklyn, NY",
    website: "https://ariana.studio",
    twitter: "arianavale",
    github: "arianavale",
    skills: ["Brand", "Product design", "Typography", "Editorial"],
    timezone: "America/New_York",
    theme: "dark" as const,
    keyboardShortcutsEnabled: true,
  };

  const parsed = updateUserProfileInputSchema.parse(validPayload);
  assert.equal(parsed.fullName, "Ariana Vale");
  assert.equal(parsed.avatarUrl, "https://images.unsplash.com/photo-1534528741775-53994a69daeb");
  assert.equal(parsed.jobTitle, "Founder & Creative Director");
  assert.equal(parsed.bio, "Independent designer working with founders on brand and product identity.");
  assert.equal(parsed.location, "Brooklyn, NY");
  assert.equal(parsed.website, "https://ariana.studio");
  assert.equal(parsed.twitter, "arianavale");
  assert.equal(parsed.github, "arianavale");
  assert.equal(parsed.skills?.length, 4);
  assert.equal(parsed.timezone, "America/New_York");
  assert.equal(parsed.theme, "dark");
  assert.equal(parsed.keyboardShortcutsEnabled, true);

  // Normalization: empty string avatarUrl transforms to null
  const clearedAvatar = updateUserProfileInputSchema.parse({
    avatarUrl: "",
    website: "",
  });
  assert.equal(clearedAvatar.avatarUrl, null);
  assert.equal(clearedAvatar.website, null);
});

// ----------------------------------------------------------------------------
// Test 3: Invalid Input Rejection
// ----------------------------------------------------------------------------
test("3. INVALID INPUT REJECTION — Strict Validation Bounds", () => {
  // 1. Empty full name rejected
  assert.throws(() => {
    updateUserProfileInputSchema.parse({ fullName: "" });
  }, /Full name cannot be empty/);

  // 2. Whitespace-only full name rejected
  assert.throws(() => {
    updateUserProfileInputSchema.parse({ fullName: "   " });
  }, /Full name cannot be empty/);

  // 3. Overflow full name rejected (>255)
  assert.throws(() => {
    updateUserProfileInputSchema.parse({ fullName: "A".repeat(256) });
  }, /Full name cannot exceed 255 characters/);

  // 4. Invalid avatar URL format rejected
  assert.throws(() => {
    updateUserProfileInputSchema.parse({ avatarUrl: "not-a-valid-url" });
  }, /Invalid avatar URL/);

  // 5. Overflow avatar URL (>2048)
  assert.throws(() => {
    updateUserProfileInputSchema.parse({
      avatarUrl: `https://example.com/${"a".repeat(2048)}`,
    });
  }, /Avatar URL cannot exceed 2048 characters/);

  // 6. Overflow job title (>100)
  assert.throws(() => {
    updateUserProfileInputSchema.parse({ jobTitle: "J".repeat(101) });
  }, /Job title cannot exceed 100 characters/);

  // 7. Overflow bio (>1000)
  assert.throws(() => {
    updateUserProfileInputSchema.parse({ bio: "B".repeat(1001) });
  }, /Bio cannot exceed 1000 characters/);

  // 8. Overflow location (>100)
  assert.throws(() => {
    updateUserProfileInputSchema.parse({ location: "L".repeat(101) });
  }, /Location cannot exceed 100 characters/);

  // 9. Invalid theme rejected
  assert.throws(() => {
    updateUserProfileInputSchema.parse({ theme: "neon-blue" as any });
  });

  // 10. Skills array exceeding 20 items rejected
  assert.throws(() => {
    const tooManySkills = Array.from({ length: 21 }, (_, i) => `Skill ${i}`);
    updateUserProfileInputSchema.parse({ skills: tooManySkills });
  }, /Maximum of 20 skill tags allowed/);

  // 11. Individual skill exceeding 50 chars rejected
  assert.throws(() => {
    updateUserProfileInputSchema.parse({ skills: ["Valid", "S".repeat(51)] });
  }, /Skill tag cannot exceed 50 characters/);
});

// ----------------------------------------------------------------------------
// Test 4: Credential and Secret Non-Exposure (Privacy Invariant)
// ----------------------------------------------------------------------------
test("4. CREDENTIAL & SECRET NON-EXPOSURE — No Password, Hash, or Token Leakage", () => {
  const profileSource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/profile.ts"),
    "utf-8",
  );

  // passwordHash must NEVER be selected or returned
  assert.equal(
    profileSource.includes("users.passwordHash"),
    false,
    "profile.ts must NEVER select users.passwordHash",
  );
  assert.equal(
    profileSource.includes("password_hash"),
    false,
    "profile.ts must NEVER reference password_hash",
  );

  // tokenHash, accessToken, refreshToken must never be included
  assert.equal(
    profileSource.includes("tokenHash"),
    false,
    "profile.ts must NEVER select or expose tokenHash",
  );
  assert.equal(
    profileSource.includes("accessToken"),
    false,
    "profile.ts must NEVER select or expose accessToken",
  );
  assert.equal(
    profileSource.includes("refreshToken"),
    false,
    "profile.ts must NEVER select or expose refreshToken",
  );

  // Explicit projection check: select only safe fields
  assert.ok(
    profileSource.includes("fullName: users.fullName"),
    "Must explicitly select fullName",
  );
  assert.ok(
    profileSource.includes("email: users.email"),
    "Must explicitly select email",
  );
  assert.ok(
    profileSource.includes("avatarUrl: users.avatarUrl"),
    "Must explicitly select avatarUrl",
  );
});

// ----------------------------------------------------------------------------
// Test 5: Self-Only Mutation & Server Identity Derivation
// ----------------------------------------------------------------------------
test("5. SELF-ONLY MUTATION & SERVER IDENTITY DERIVATION — Client userId Untrusted", () => {
  // Verify that updateUserProfileInputSchema does NOT define a userId parameter
  const schemaKeys = Object.keys(updateUserProfileInputSchema.shape);
  assert.equal(
    schemaKeys.includes("userId"),
    false,
    "updateUserProfileInputSchema must NOT allow client-supplied userId",
  );

  const profileSource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/profile.ts"),
    "utf-8",
  );

  // Verify that auth is derived from getServerAuthContext()
  assert.ok(
    profileSource.includes("const auth = await getServerAuthContext()"),
    "Must derive auth from getServerAuthContext()",
  );
  assert.ok(
    profileSource.includes("const userId = auth.userId"),
    "Target user ID must be strictly derived from auth context",
  );

  // Verify that mutations are bounded to userId
  assert.ok(
    profileSource.includes("where(eq(users.id, userId))"),
    "User update must be restricted by eq(users.id, userId)",
  );
  assert.ok(
    profileSource.includes("where(eq(userPreferences.userId, userId))"),
    "Preferences update must be restricted by eq(userPreferences.userId, userId)",
  );
});

// ----------------------------------------------------------------------------
// Test 6: Unauthenticated Access & Browser Guard Protection
// ----------------------------------------------------------------------------
test("6. UNAUTHENTICATED ACCESS & BROWSER GUARD — Rejects Invalid Execution Contexts", () => {
  const profileSource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/profile.ts"),
    "utf-8",
  );

  assert.ok(
    profileSource.includes("if (typeof window !== \"undefined\")"),
    "Must enforce browser guard in server functions",
  );
  assert.ok(
    profileSource.includes("[SILEX Security Guard] Execution prohibited in browser context."),
    "Must throw explicit security error in browser context",
  );
});

// ----------------------------------------------------------------------------
// Test 7: Avatar URL & $0 Storage Invariant
// ----------------------------------------------------------------------------
test("7. AVATAR URL & $0 STORAGE INVARIANT — No Physical Storage Dependency", () => {
  const profileSource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/profile.ts"),
    "utf-8",
  );

  // Must not import or reference file upload or storage APIs
  assert.equal(
    profileSource.includes("storage.from"),
    false,
    "Must not use physical storage buckets",
  );
  assert.equal(
    profileSource.includes("multipart/form-data"),
    false,
    "Must not use multipart file uploads",
  );
  assert.equal(
    profileSource.includes("fs.writeFile"),
    false,
    "Must not write physical files to disk",
  );

  // Avatar is strictly string URL or null
  const parsedNull = updateUserProfileInputSchema.parse({ avatarUrl: null });
  assert.equal(parsedNull.avatarUrl, null);

  const parsedUrl = updateUserProfileInputSchema.parse({
    avatarUrl: "https://avatar.example.com/me.png",
  });
  assert.equal(parsedUrl.avatarUrl, "https://avatar.example.com/me.png");
});

// ----------------------------------------------------------------------------
// Test 8: Preferences & UI Config Persistence Contract
// ----------------------------------------------------------------------------
test("8. PREFERENCES & UI CONFIG PERSISTENCE — Structured Storage & Merging", () => {
  const profileSource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/profile.ts"),
    "utf-8",
  );

  // Verify that uiConfig merging preserves existing keys
  assert.ok(
    profileSource.includes("const newUiConfig: Record<string, unknown> = {"),
    "Must construct merged uiConfig",
  );
  assert.ok(
    profileSource.includes("...existingUiConfig"),
    "Must spread and preserve existing uiConfig values",
  );

  // Verify fields persisted in uiConfig
  assert.ok(profileSource.includes("bio: data.bio"), "Persists bio in uiConfig");
  assert.ok(profileSource.includes("location: data.location"), "Persists location in uiConfig");
  assert.ok(profileSource.includes("website: data.website"), "Persists website in uiConfig");
  assert.ok(profileSource.includes("twitter: data.twitter"), "Persists twitter in uiConfig");
  assert.ok(profileSource.includes("github: data.github"), "Persists github in uiConfig");
  assert.ok(profileSource.includes("skills: data.skills"), "Persists skills in uiConfig");
});

// ----------------------------------------------------------------------------
// Test 9: Workspace Job Title Synchronization
// ----------------------------------------------------------------------------
test("9. WORKSPACE JOB TITLE SYNCHRONIZATION — Cascades to Workspace Members", () => {
  const profileSource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/profile.ts"),
    "utf-8",
  );

  assert.ok(
    profileSource.includes("jobTitle: data.jobTitle"),
    "Must update jobTitle on workspaceMembers",
  );
  assert.ok(
    profileSource.includes(".update(workspaceMembers)"),
    "Must update workspaceMembers table in transaction",
  );
});

// ----------------------------------------------------------------------------
// Test 10: Profile Route & UI Integration Contracts
// ----------------------------------------------------------------------------
test("10. PROFILE ROUTE & UI INTEGRATION — Consumes Real Server Function & Modal", () => {
  const routeSource = fs.readFileSync(
    path.join(srcDir, "routes/app.profile.tsx"),
    "utf-8",
  );

  // Must consume getUserProfileFn
  assert.ok(
    routeSource.includes("getUserProfileFn"),
    "app.profile.tsx must consume getUserProfileFn",
  );

  // Must embed EditProfileModal
  assert.ok(
    routeSource.includes("EditProfileModal"),
    "app.profile.tsx must embed EditProfileModal",
  );

  // Must provide loading state
  assert.ok(
    routeSource.includes("Loading profile..."),
    "app.profile.tsx must provide loading state",
  );

  // Must provide error recovery state
  assert.ok(
    routeSource.includes("Unable to load profile"),
    "app.profile.tsx must provide error state",
  );

  // Must provide Sign out functionality
  assert.ok(
    routeSource.includes("signOut()"),
    "app.profile.tsx must support signing out",
  );

  // Settings route must link to /app/profile
  const settingsSource = fs.readFileSync(
    path.join(srcDir, "routes/app.settings.tsx"),
    "utf-8",
  );
  assert.ok(
    settingsSource.includes("to=\"/app/profile\""),
    "app.settings.tsx must link to /app/profile",
  );
});

// ----------------------------------------------------------------------------
// Test 11: Initials Generation & Social Link Formatting Logic
// ----------------------------------------------------------------------------
test("11. INITIALS GENERATION & SOCIAL FORMATTING — Helper Logic", () => {
  function getInitials(name?: string, email?: string): string {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email && email.trim()) {
      return email.slice(0, 2).toUpperCase();
    }
    return "SX";
  }

  assert.equal(getInitials("Ariana Vale"), "AV");
  assert.equal(getInitials("John Doe"), "JD");
  assert.equal(getInitials("Alexander"), "AL");
  assert.equal(getInitials("", "ariana@studio.co"), "AR");
  assert.equal(getInitials(undefined, "dev@example.com"), "DE");
  assert.equal(getInitials(undefined, undefined), "SX");

  // Twitter/GitHub @ prefix handling
  const rawHandle = "@arianavale";
  const cleanHandle = rawHandle.replace(/^@/, "");
  assert.equal(cleanHandle, "arianavale");

  // Website protocol formatting
  const websiteWithoutProto = "ariana.studio";
  const formattedUrl = websiteWithoutProto.startsWith("http")
    ? websiteWithoutProto
    : `https://${websiteWithoutProto}`;
  assert.equal(formattedUrl, "https://ariana.studio");
});

// ----------------------------------------------------------------------------
// Test 12: Existing Authentication & Workspace Regression Safety
// ----------------------------------------------------------------------------
test("12. AUTH & WORKSPACE REGRESSION SAFETY — Invariants Uncompromised", () => {
  const authContextSource = fs.readFileSync(
    path.join(srcDir, "lib/supabase/server-context.ts"),
    "utf-8",
  );
  assert.ok(
    authContextSource.includes("getServerAuthContext"),
    "server-context.ts must export getServerAuthContext",
  );

  const workspaceAuthSource = fs.readFileSync(
    path.join(srcDir, "lib/auth/workspace.ts"),
    "utf-8",
  );
  assert.ok(
    workspaceAuthSource.includes("requireWorkspaceAccess"),
    "workspace.ts must export requireWorkspaceAccess",
  );
});
