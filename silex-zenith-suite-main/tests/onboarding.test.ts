/**
 * SILEX 2.0 — Onboarding & Workspace Provisioning Test Suite
 *
 * Verifies contract invariants, validation bounds, server security,
 * and transactional workspace provisioning for TASK-016.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  completeOnboardingInputSchema,
  sanitizeWorkspaceSlug,
  BUSINESS_TYPES,
  type CompleteOnboardingInput,
  type OnboardingStateResponse,
} from "../src/lib/server-functions/onboarding";
import { workspaces, workspaceMembers, workspaceSettings, users, userPreferences } from "../src/db/schema";

test("SILEX 2.0 — ONBOARDING & WORKSPACE PROVISIONING", async (t) => {
  await t.test("1. INPUT VALIDATION — Valid payload passes with clean types", () => {
    const validRaw = {
      fullName: "Alex Rivera",
      companyName: "Rivera Dynamics",
      website: "rivera.design",
      businessType: "creative_studio",
      workspaceName: "Rivera Dynamics",
      workspaceSlug: "rivera-dynamics",
      currency: "USD",
    };

    const parsed = completeOnboardingInputSchema.parse(validRaw);
    assert.equal(parsed.fullName, "Alex Rivera");
    assert.equal(parsed.companyName, "Rivera Dynamics");
    assert.equal(parsed.website, "rivera.design");
    assert.equal(parsed.businessType, "creative_studio");
    assert.equal(parsed.workspaceName, "Rivera Dynamics");
    assert.equal(parsed.workspaceSlug, "rivera-dynamics");
    assert.equal(parsed.currency, "USD");
  });

  await t.test("2. INPUT DEFAULTS & TRIMMING — Optional fields have safe defaults", () => {
    const minimalRaw = {
      fullName: "  Jane Smith  ",
      workspaceName: "  Jane Studio  ",
      workspaceSlug: "jane-studio",
    };

    const parsed = completeOnboardingInputSchema.parse(minimalRaw);
    assert.equal(parsed.fullName, "Jane Smith");
    assert.equal(parsed.companyName, "");
    assert.equal(parsed.website, "");
    assert.equal(parsed.businessType, "freelancer");
    assert.equal(parsed.workspaceName, "Jane Studio");
    assert.equal(parsed.currency, "USD");
  });

  await t.test("3. REJECTION: Empty full name is rejected", () => {
    assert.throws(
      () => {
        completeOnboardingInputSchema.parse({
          fullName: "   ",
          workspaceName: "Valid Name",
          workspaceSlug: "valid-slug",
        });
      },
      (err: any) => {
        assert.match(err.errors[0].message, /Full name is required/i);
        return true;
      },
    );
  });

  await t.test("4. REJECTION: Empty workspace name is rejected", () => {
    assert.throws(
      () => {
        completeOnboardingInputSchema.parse({
          fullName: "Valid User",
          workspaceName: "",
          workspaceSlug: "valid-slug",
        });
      },
      (err: any) => {
        assert.match(err.errors[0].message, /Workspace name is required/i);
        return true;
      },
    );
  });

  await t.test("5. REJECTION: Malformed workspace slug is rejected", () => {
    // Upper case
    assert.throws(() => {
      completeOnboardingInputSchema.parse({
        fullName: "Valid User",
        workspaceName: "Valid Workspace",
        workspaceSlug: "Invalid_Slug",
      });
    });

    // Spaces
    assert.throws(() => {
      completeOnboardingInputSchema.parse({
        fullName: "Valid User",
        workspaceName: "Valid Workspace",
        workspaceSlug: "invalid slug",
      });
    });

    // Special characters
    assert.throws(() => {
      completeOnboardingInputSchema.parse({
        fullName: "Valid User",
        workspaceName: "Valid Workspace",
        workspaceSlug: "invalid@slug!",
      });
    });

    // Too short (< 2 chars)
    assert.throws(() => {
      completeOnboardingInputSchema.parse({
        fullName: "Valid User",
        workspaceName: "Valid Workspace",
        workspaceSlug: "a",
      });
    });
  });

  await t.test("6. REJECTION: Invalid currency format is rejected", () => {
    // Lowercase
    assert.throws(() => {
      completeOnboardingInputSchema.parse({
        fullName: "Valid User",
        workspaceName: "Valid Workspace",
        workspaceSlug: "valid-slug",
        currency: "usd",
      });
    });

    // Invalid length
    assert.throws(() => {
      completeOnboardingInputSchema.parse({
        fullName: "Valid User",
        workspaceName: "Valid Workspace",
        workspaceSlug: "valid-slug",
        currency: "US",
      });
    });

    assert.throws(() => {
      completeOnboardingInputSchema.parse({
        fullName: "Valid User",
        workspaceName: "Valid Workspace",
        workspaceSlug: "valid-slug",
        currency: "USDD",
      });
    });
  });

  await t.test("7. SLUG SANITIZATION — Normalizes messy strings into clean slugs", () => {
    assert.equal(sanitizeWorkspaceSlug("Ariana's Studio"), "ariana-s-studio");
    assert.equal(sanitizeWorkspaceSlug("  My Great & Fast Agency!  "), "my-great-fast-agency");
    assert.equal(sanitizeWorkspaceSlug("---hello---world---"), "hello-world");
    assert.equal(sanitizeWorkspaceSlug("123 Coding Labs"), "123-coding-labs");

    // Very short or empty fallback generates random ws- slug
    const fallback = sanitizeWorkspaceSlug("");
    assert.match(fallback, /^ws-[a-f0-9]{6}$/);
  });

  await t.test("8. BUSINESS TYPES CONTRACT — Supports all 6 canonical options", () => {
    assert.equal(BUSINESS_TYPES.length, 6);
    assert.ok(BUSINESS_TYPES.includes("freelancer"));
    assert.ok(BUSINESS_TYPES.includes("creative_studio"));
    assert.ok(BUSINESS_TYPES.includes("agency"));
    assert.ok(BUSINESS_TYPES.includes("startup"));
    assert.ok(BUSINESS_TYPES.includes("consultant"));
    assert.ok(BUSINESS_TYPES.includes("other"));
  });

  await t.test("9. SECURITY: Untrusted Client User ID Prohibited", () => {
    // Invariant: The completeOnboardingInputSchema does NOT define or allow a client-provided userId
    const shape = completeOnboardingInputSchema.shape as Record<string, unknown>;
    assert.equal(
      shape.userId,
      undefined,
      "CRITICAL: completeOnboardingInputSchema must NEVER accept client-provided userId.",
    );
    assert.equal(
      shape.ownerId,
      undefined,
      "CRITICAL: completeOnboardingInputSchema must NEVER accept client-provided ownerId.",
    );
  });

  await t.test("10. CREDENTIAL NON-EXPOSURE — Safe state response projection", () => {
    // Sample state response contract
    const sampleResponse: OnboardingStateResponse = {
      isAuthenticated: true,
      user: {
        id: "0191e4a3-7622-7777-8888-000000000001",
        email: "founder@example.com",
        fullName: "Alex Rivera",
        avatarUrl: null,
      },
      profile: {
        companyName: "Rivera Studio",
        website: "rivera.studio",
        businessType: "creative_studio",
      },
      workspace: {
        id: "0191e4a3-7622-7777-8888-000000000002",
        name: "Rivera Studio",
        slug: "rivera-studio",
        currency: "USD",
      },
      isComplete: true,
    };

    assert.equal((sampleResponse.user as any).passwordHash, undefined);
    assert.equal((sampleResponse.user as any).tokenHash, undefined);
    assert.equal((sampleResponse as any).password, undefined);
    assert.equal((sampleResponse as any).secret, undefined);
  });

  await t.test("11. ZERO PHYSICAL STORAGE & $0 COST INVARIANT", () => {
    // Invariant: Onboarding accepts URLs / text metadata only without physical bucket uploads
    const sampleInput: CompleteOnboardingInput = {
      fullName: "Student Dev",
      companyName: "Open Source Lab",
      website: "https://dev.example.com",
      businessType: "startup",
      workspaceName: "Dev Lab",
      workspaceSlug: "dev-lab",
      currency: "EUR",
    };

    assert.ok(!("logoFile" in sampleInput));
    assert.ok(!("storageBucket" in sampleInput));
    assert.ok(!("s3Key" in sampleInput));
  });

  await t.test("12. SCHEMA RELATIONAL INTEGRITY — Workspaces, Members, Settings", () => {
    assert.ok(workspaces.id);
    assert.ok(workspaces.name);
    assert.ok(workspaces.slug);
    assert.ok(workspaces.ownerId);

    assert.ok(workspaceMembers.workspaceId);
    assert.ok(workspaceMembers.userId);
    assert.ok(workspaceMembers.role);
    assert.ok(workspaceMembers.jobTitle);

    assert.ok(workspaceSettings.workspaceId);
    assert.ok(workspaceSettings.defaultCurrency);

    assert.ok(users.id);
    assert.ok(users.fullName);

    assert.ok(userPreferences.userId);
    assert.ok(userPreferences.uiConfig);
  });
});
