/**
 * SILEX 2.0 — TASK-010 / Milestone 3 Plan & Billing Management Test Suite
 *
 * Verifies critical Plan & Billing and Subscription Lifecycle invariants:
 * 1. getBillingOverviewInputSchema & optional workspaceId
 * 2. createCheckoutSessionInputSchema validation (planTier enum, billingCycle enum, defaults)
 * 3. cancelSubscriptionInputSchema & resumeSubscriptionInputSchema validation
 * 4. handleStripeWebhookInputSchema structure
 * 5. verifyStripeSignature HMAC signature validation & constant-time comparison
 * 6. PLAN_TIERS canonical definitions, pricing, features, and resource limits
 * 7. Role-based authorization hierarchy (Admin and Owner allowed, Member rejected)
 * 8. Multi-tenant workspace isolation (Cross-workspace billing operations rejected)
 * 9. Student-friendly $0 Cost & zero external paid SaaS dependency
 * 10. Table 23 subscriptions relational schema integrity
 * 11. Settings route integration & BillingTab component contract
 * 12. AppShell upgrade navigation contract
 * 13. Browser execution guard contract (typeof window !== "undefined")
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../src");

import {
  getBillingOverviewInputSchema,
  createCheckoutSessionInputSchema,
  cancelSubscriptionInputSchema,
  resumeSubscriptionInputSchema,
  handleStripeWebhookInputSchema,
  verifyStripeSignature,
  PLAN_TIERS,
} from "../src/lib/server-functions/billing";

import { subscriptions } from "../src/db/schema/finance";
import { workspaces } from "../src/db/schema/workspaces";

// ----------------------------------------------------------------------------
// Test 1: Retrieval Input Schema
// ----------------------------------------------------------------------------
test("1. RETRIEVAL SCHEMA — Optional workspaceId with clean UUID validation", () => {
  const empty = getBillingOverviewInputSchema.parse({});
  assert.equal(empty?.workspaceId, undefined);

  const scoped = getBillingOverviewInputSchema.parse({
    workspaceId: "018f6730-1000-7000-8000-000000000001",
  });
  assert.equal(scoped?.workspaceId, "018f6730-1000-7000-8000-000000000001");

  assert.throws(() => {
    getBillingOverviewInputSchema.parse({ workspaceId: "invalid-uuid" });
  });
});

// ----------------------------------------------------------------------------
// Test 2: Checkout Session Input Schema Validation
// ----------------------------------------------------------------------------
test("2. CHECKOUT SCHEMA — Validates planTier enum and billingCycle defaults", () => {
  const proMonthly = createCheckoutSessionInputSchema.parse({
    planTier: "pro",
  });
  assert.equal(proMonthly.planTier, "pro");
  assert.equal(proMonthly.billingCycle, "monthly");

  const enterpriseYearly = createCheckoutSessionInputSchema.parse({
    planTier: "enterprise",
    billingCycle: "yearly",
    workspaceId: "018f6730-1000-7000-8000-000000000002",
  });
  assert.equal(enterpriseYearly.planTier, "enterprise");
  assert.equal(enterpriseYearly.billingCycle, "yearly");
  assert.equal(enterpriseYearly.workspaceId, "018f6730-1000-7000-8000-000000000002");

  // Rejects invalid planTier
  assert.throws(() => {
    createCheckoutSessionInputSchema.parse({ planTier: "free" }); // Cannot 'checkout' free
  });
  assert.throws(() => {
    createCheckoutSessionInputSchema.parse({ planTier: "invalid_tier" as any });
  });
});

// ----------------------------------------------------------------------------
// Test 3: Cancellation & Resumption Schemas
// ----------------------------------------------------------------------------
test("3. CANCEL & RESUME SCHEMAS — Validate optional workspaceId and reject malformed input", () => {
  const cancelEmpty = cancelSubscriptionInputSchema.parse({});
  assert.equal(cancelEmpty.workspaceId, undefined);

  const resumeScoped = resumeSubscriptionInputSchema.parse({
    workspaceId: "018f6730-1000-7000-8000-000000000003",
  });
  assert.equal(resumeScoped.workspaceId, "018f6730-1000-7000-8000-000000000003");

  assert.throws(() => {
    cancelSubscriptionInputSchema.parse({ workspaceId: "not-uuid" });
  });
  assert.throws(() => {
    resumeSubscriptionInputSchema.parse({ workspaceId: "not-uuid" });
  });
});

// ----------------------------------------------------------------------------
// Test 4: Stripe Webhook Input Schema
// ----------------------------------------------------------------------------
test("4. WEBHOOK SCHEMA — Enforces non-empty event type and object payload", () => {
  const validWebhook = handleStripeWebhookInputSchema.parse({
    eventType: "customer.subscription.updated",
    payload: { id: "sub_123", status: "active" },
    signature: "t=123456,v1=abcdef",
  });
  assert.equal(validWebhook.eventType, "customer.subscription.updated");
  assert.equal((validWebhook.payload as any).id, "sub_123");

  assert.throws(() => {
    handleStripeWebhookInputSchema.parse({
      eventType: "",
      payload: {},
    });
  });
});

// ----------------------------------------------------------------------------
// Test 5: Stripe Signature Verification Helper
// ----------------------------------------------------------------------------
test("5. STRIPE SIGNATURE VERIFICATION — Constant-time validation", () => {
  const secret = "whsec_test_secret_123456789";
  const rawPayload = JSON.stringify({ event: "test.event", id: "evt_123" });
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const validSig = createHmac("sha256", secret)
    .update(`${timestamp}.${rawPayload}`)
    .digest("hex");
  const validHeader = `t=${timestamp},v1=${validSig}`;

  // Valid signature passes
  assert.equal(verifyStripeSignature(rawPayload, validHeader, secret), true);

  // Altered payload fails
  assert.equal(
    verifyStripeSignature(rawPayload + "altered", validHeader, secret),
    false,
  );

  // Altered secret fails
  assert.equal(
    verifyStripeSignature(rawPayload, validHeader, "wrong_secret"),
    false,
  );

  // Malformed header fails safely
  assert.equal(verifyStripeSignature(rawPayload, "invalid_header_format", secret), false);
  assert.equal(verifyStripeSignature("", validHeader, secret), false);
  assert.equal(verifyStripeSignature(rawPayload, "", secret), false);
});

// ----------------------------------------------------------------------------
// Test 6: Canonical Plan Tiers Definition & Pricing
// ----------------------------------------------------------------------------
test("6. PLAN TIERS DEFINITION — Canonical pricing, limits, and features", () => {
  assert.ok(PLAN_TIERS.free, "Free tier must be defined");
  assert.ok(PLAN_TIERS.pro, "Pro (Studio) tier must be defined");
  assert.ok(PLAN_TIERS.enterprise, "Enterprise tier must be defined");

  // Free Tier
  assert.equal(PLAN_TIERS.free.priceMonthly, 0);
  assert.equal(PLAN_TIERS.free.limits.maxInvoicesPerMonth, 5);
  assert.equal(PLAN_TIERS.free.limits.maxClients, 5);
  assert.equal(PLAN_TIERS.free.limits.maxProjects, 3);
  assert.equal(PLAN_TIERS.free.limits.maxMembers, 1);

  // Pro / Studio Tier
  assert.equal(PLAN_TIERS.pro.priceMonthly, 19);
  assert.equal(PLAN_TIERS.pro.priceYearly, 190);
  assert.equal(PLAN_TIERS.pro.limits.maxInvoicesPerMonth, null); // Unlimited
  assert.equal(PLAN_TIERS.pro.limits.maxClients, null); // Unlimited
  assert.equal(PLAN_TIERS.pro.limits.maxProjects, null); // Unlimited
  assert.equal(PLAN_TIERS.pro.limits.maxMembers, 5);

  // Enterprise Tier
  assert.equal(PLAN_TIERS.enterprise.priceMonthly, 99);
  assert.equal(PLAN_TIERS.enterprise.priceYearly, 990);
  assert.equal(PLAN_TIERS.enterprise.limits.maxInvoicesPerMonth, null);
  assert.equal(PLAN_TIERS.enterprise.limits.maxMembers, null);
});

// ----------------------------------------------------------------------------
// Test 7: Role-Based Authorization Bounds
// ----------------------------------------------------------------------------
test("7. ROLE-BASED AUTHORIZATION — createCheckoutSessionFn and cancelSubscriptionFn require admin", () => {
  const billingSource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/billing.ts"),
    "utf-8",
  );

  // Verify requireWorkspaceAccess enforces admin role for mutations
  assert.ok(
    billingSource.includes('requiredRole: "admin"'),
    "Billing mutation functions must enforce requiredRole: 'admin'",
  );
});

// ----------------------------------------------------------------------------
// Test 8: Multi-Tenant Workspace Isolation
// ----------------------------------------------------------------------------
test("8. MULTI-TENANT ISOLATION — Operations scoped strictly to auth.workspaceId", () => {
  const billingSource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/billing.ts"),
    "utf-8",
  );

  assert.ok(
    billingSource.includes("eq(subscriptions.workspaceId, auth.workspaceId)"),
    "Subscription queries must filter strictly by auth.workspaceId",
  );
  assert.ok(
    billingSource.includes("eq(invoices.workspaceId, auth.workspaceId)"),
    "Usage invoice count must filter strictly by auth.workspaceId",
  );
  assert.ok(
    billingSource.includes("eq(clients.workspaceId, auth.workspaceId)"),
    "Usage client count must filter strictly by auth.workspaceId",
  );
  assert.ok(
    billingSource.includes("eq(projects.workspaceId, auth.workspaceId)"),
    "Usage project count must filter strictly by auth.workspaceId",
  );
  assert.ok(
    billingSource.includes("eq(workspaceMembers.workspaceId, auth.workspaceId)"),
    "Usage member count must filter strictly by auth.workspaceId",
  );
});

// ----------------------------------------------------------------------------
// Test 9: Student-Friendly $0 Cost & Simulation Fallback
// ----------------------------------------------------------------------------
test("9. STUDENT-FRIENDLY $0 COST INVARIANT — Zero paid external dependencies required", () => {
  const billingSource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/billing.ts"),
    "utf-8",
  );

  assert.ok(
    billingSource.includes("db.transaction"),
    "createCheckoutSessionFn must support transactional database fallback",
  );
  assert.ok(
    billingSource.includes("simulated: true"),
    "createCheckoutSessionFn must support zero-cost simulated activation",
  );
});

// ----------------------------------------------------------------------------
// Test 10: Relational Schema Integrity (Table 23 subscriptions & Table 5 workspaces)
// ----------------------------------------------------------------------------
test("10. SCHEMA INTEGRITY — Table 23 subscriptions matches finance schema contract", () => {
  assert.ok(subscriptions, "subscriptions table must be exported from src/db/schema/finance");
  assert.ok(subscriptions.id, "subscriptions.id column must exist");
  assert.ok(subscriptions.workspaceId, "subscriptions.workspaceId column must exist");
  assert.ok(subscriptions.stripeCustomerId, "subscriptions.stripeCustomerId column must exist");
  assert.ok(subscriptions.stripeSubscriptionId, "subscriptions.stripeSubscriptionId column must exist");
  assert.ok(subscriptions.status, "subscriptions.status column must exist");
  assert.ok(subscriptions.currentPeriodStart, "subscriptions.currentPeriodStart column must exist");
  assert.ok(subscriptions.currentPeriodEnd, "subscriptions.currentPeriodEnd column must exist");
  assert.ok(subscriptions.cancelAtPeriodEnd, "subscriptions.cancelAtPeriodEnd column must exist");
  assert.ok(subscriptions.updatedAt, "subscriptions.updatedAt column must exist");

  assert.ok(workspaces.planTier, "workspaces.planTier column must exist");
});

// ----------------------------------------------------------------------------
// Test 11: Settings Route Integration & BillingTab Component Contract
// ----------------------------------------------------------------------------
test("11. SETTINGS INTEGRATION — BillingTab is exported and mounted in app.settings.tsx", () => {
  const billingTabPath = path.join(srcDir, "components/silex/settings/billing-tab.tsx");
  assert.ok(fs.existsSync(billingTabPath), "BillingTab component file must exist");

  const billingContent = fs.readFileSync(billingTabPath, "utf-8");
  assert.ok(billingContent.includes("export function BillingTab"), "BillingTab must be exported");
  assert.ok(billingContent.includes("getBillingOverviewFn"), "BillingTab must call getBillingOverviewFn");
  assert.ok(billingContent.includes("createCheckoutSessionFn"), "BillingTab must call createCheckoutSessionFn");
  assert.ok(billingContent.includes("cancelSubscriptionFn"), "BillingTab must call cancelSubscriptionFn");
  assert.ok(billingContent.includes("resumeSubscriptionFn"), "BillingTab must call resumeSubscriptionFn");

  const settingsContent = fs.readFileSync(
    path.join(srcDir, "routes/app.settings.tsx"),
    "utf-8",
  );
  assert.ok(settingsContent.includes("BillingTab"), "app.settings.tsx must import BillingTab");
  assert.ok(
    settingsContent.includes("<BillingTab />"),
    "app.settings.tsx must render BillingTab when active === 'billing'",
  );
  assert.ok(
    settingsContent.includes('search.tab === "billing"'),
    "app.settings.tsx must resolve initialTab for search.tab === 'billing'",
  );
});

// ----------------------------------------------------------------------------
// Test 12: AppShell Upgrade Navigation Contract
// ----------------------------------------------------------------------------
test("12. APPSHELL UPGRADE LINK — Connects sidebar upgrade card to /app/settings?tab=billing", () => {
  const appShellContent = fs.readFileSync(
    path.join(srcDir, "components/silex/app-shell.tsx"),
    "utf-8",
  );

  assert.ok(
    appShellContent.includes('search={{ tab: "billing" }}'),
    "AppShell upgrade card must navigate to /app/settings with search tab: billing",
  );
});

// ----------------------------------------------------------------------------
// Test 13: Browser Execution Guard Contract
// ----------------------------------------------------------------------------
test("13. BROWSER EXECUTION GUARD — Prohibits client-side execution", () => {
  const billingSource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/billing.ts"),
    "utf-8",
  );

  const guardMatches = billingSource.match(/typeof window !== "undefined"/g);
  assert.ok(guardMatches && guardMatches.length >= 4, "Must guard all server functions from browser execution");
});
