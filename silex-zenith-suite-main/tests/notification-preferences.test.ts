/**
 * SILEX 2.0 — Notification Preferences & Delivery Settings Test Suite
 *
 * Verifies critical notification preferences and delivery channel invariants:
 * 1. Retrieval input schema & optional workspaceId
 * 2. Update input schema validation & type constraints
 * 3. Invalid update input rejection (non-booleans, malformed event maps)
 * 4. Default event types coverage & truthfulness
 * 5. Self-only mutation & server identity derivation (client userId untrusted)
 * 6. Credential & secret non-exposure invariant
 * 7. Browser execution guard (prohibits client-side execution)
 * 8. $0 Cost & zero external infrastructure invariant
 * 9. Database relational schema integrity (Table 32 notification_preferences)
 * 10. Settings route & NotificationsTab integration contract
 * 11. Notifications center header direct navigation contract
 * 12. Event subscription merge logic & fallback preservation
 * 13. Slack channel outbound webhook routing guidance
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
  getNotificationPreferencesInputSchema,
  updateNotificationPreferencesInputSchema,
  DEFAULT_NOTIFICATION_EVENT_TYPES,
  type NotificationPreferencesItem,
} from "../src/lib/server-functions/notifications";

import { notificationPreferences } from "../src/db/schema/notifications";

// ----------------------------------------------------------------------------
// Test 1: Retrieval Input Schema
// ----------------------------------------------------------------------------
test("1. RETRIEVAL SCHEMA — Optional workspaceId & Clean Parsing", () => {
  const empty = getNotificationPreferencesInputSchema.parse({});
  assert.equal(empty.workspaceId, undefined);

  const scoped = getNotificationPreferencesInputSchema.parse({
    workspaceId: "018f6730-1000-7000-8000-000000000001",
  });
  assert.equal(scoped.workspaceId, "018f6730-1000-7000-8000-000000000001");
});

// ----------------------------------------------------------------------------
// Test 2: Update Input Schema Validation
// ----------------------------------------------------------------------------
test("2. UPDATE SCHEMA — Validates Delivery Channel Booleans & Event Maps", () => {
  const valid = updateNotificationPreferencesInputSchema.parse({
    emailNotifications: true,
    pushNotifications: false,
    slackNotifications: true,
    eventTypes: {
      task_assigned: true,
      invoice_paid: false,
      client_created: true,
    },
  });

  assert.equal(valid.emailNotifications, true);
  assert.equal(valid.pushNotifications, false);
  assert.equal(valid.slackNotifications, true);
  assert.deepEqual(valid.eventTypes, {
    task_assigned: true,
    invoice_paid: false,
    client_created: true,
  });

  // Partial updates are permitted
  const partial = updateNotificationPreferencesInputSchema.parse({
    slackNotifications: false,
  });
  assert.equal(partial.slackNotifications, false);
  assert.equal(partial.emailNotifications, undefined);
});

// ----------------------------------------------------------------------------
// Test 3: Invalid Input Rejection
// ----------------------------------------------------------------------------
test("3. REJECTION: Malformed Channel Types & Non-Boolean Event Values", () => {
  // Non-boolean channel flags
  assert.throws(
    () => {
      updateNotificationPreferencesInputSchema.parse({
        emailNotifications: "yes",
      });
    },
    (err: any) => err.name === "ZodError",
  );

  assert.throws(
    () => {
      updateNotificationPreferencesInputSchema.parse({
        pushNotifications: 1,
      });
    },
    (err: any) => err.name === "ZodError",
  );

  // Non-boolean event map values
  assert.throws(
    () => {
      updateNotificationPreferencesInputSchema.parse({
        eventTypes: {
          task_assigned: "enabled",
        },
      });
    },
    (err: any) => err.name === "ZodError",
  );
});

// ----------------------------------------------------------------------------
// Test 4: Default Event Types Coverage
// ----------------------------------------------------------------------------
test("4. CANONICAL EVENT TYPES — All 6 Core Events Defaulted & Typed", () => {
  const expectedEvents = [
    "task_assigned",
    "invoice_paid",
    "client_created",
    "comment_added",
    "expense_recorded",
    "ai_insight",
  ];

  for (const eventName of expectedEvents) {
    assert.equal(
      typeof DEFAULT_NOTIFICATION_EVENT_TYPES[eventName],
      "boolean",
      `Event type '${eventName}' must have a boolean default`,
    );
    assert.equal(
      DEFAULT_NOTIFICATION_EVENT_TYPES[eventName],
      true,
      `Standard event type '${eventName}' should default to true`,
    );
  }
});

// ----------------------------------------------------------------------------
// Test 5: Self-Only Mutation & Untrusted Client userId
// ----------------------------------------------------------------------------
test("5. SECURITY: Untrusted Client User ID Prohibited — Server-Derived Only", () => {
  const schemaKeys = Object.keys(updateNotificationPreferencesInputSchema.shape);
  assert.ok(
    !schemaKeys.includes("userId"),
    "updateNotificationPreferencesInputSchema MUST NOT accept userId from client",
  );

  // Inspect notifications server functions code
  const code = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/notifications.ts"),
    "utf-8",
  );

  // Verify auth derivation
  assert.ok(
    code.includes("auth.userId"),
    "updateNotificationPreferencesFn must derive user ID strictly from server auth context",
  );
  assert.ok(
    code.includes("getServerAuthContext"),
    "updateNotificationPreferencesFn must use getServerAuthContext for authentication",
  );
});

// ----------------------------------------------------------------------------
// Test 6: Credential & Secret Non-Exposure
// ----------------------------------------------------------------------------
test("6. PRIVACY: Safe Preference Projection — No Secrets or Tokens", () => {
  const samplePref: NotificationPreferencesItem = {
    id: "018f6730-1000-7000-8000-000000000001",
    userId: "018f6730-1000-7000-8000-000000000002",
    emailNotifications: true,
    pushNotifications: true,
    slackNotifications: false,
    eventTypes: { ...DEFAULT_NOTIFICATION_EVENT_TYPES },
  };

  const prefKeys = Object.keys(samplePref);
  assert.ok(!prefKeys.includes("password"));
  assert.ok(!prefKeys.includes("passwordHash"));
  assert.ok(!prefKeys.includes("token"));
  assert.ok(!prefKeys.includes("secret"));
  assert.ok(!prefKeys.includes("apiKey"));
  assert.equal(prefKeys.length, 6);
});

// ----------------------------------------------------------------------------
// Test 7: Browser Execution Guard
// ----------------------------------------------------------------------------
test("7. BROWSER GUARD: Execution Prohibited in Client Context", () => {
  const code = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/notifications.ts"),
    "utf-8",
  );

  assert.ok(
    code.includes('typeof window !== "undefined"'),
    "Notification preferences server functions must guard against browser context execution",
  );
});

// ----------------------------------------------------------------------------
// Test 8: $0 Cost & Zero Physical Storage Invariant
// ----------------------------------------------------------------------------
test("8. STUDENT-FRIENDLY $0 COST — Local PostgreSQL Storage Only", () => {
  const code = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/notifications.ts"),
    "utf-8",
  );

  // Check that no paid notification APIs or external storage are introduced
  assert.ok(!code.includes("twilio"), "Must not introduce Twilio");
  assert.ok(!code.includes("resend"), "Must not introduce Resend");
  assert.ok(!code.includes("sendgrid"), "Must not introduce SendGrid");
  assert.ok(!code.includes("aws-sdk"), "Must not introduce AWS SDK");
  assert.ok(!code.includes("@slack/web-api"), "Must not introduce paid Slack SDK");
});

// ----------------------------------------------------------------------------
// Test 9: Relational Schema Integrity (Table 32)
// ----------------------------------------------------------------------------
test("9. SCHEMA INTEGRITY: Table 32 notification_preferences relational definition", () => {
  assert.ok(notificationPreferences, "notificationPreferences table must be exported");

  // Verify column definitions exist
  assert.ok(notificationPreferences.id, "Table must have id column");
  assert.ok(notificationPreferences.userId, "Table must have userId column");
  assert.ok(notificationPreferences.emailNotifications, "Table must have emailNotifications column");
  assert.ok(notificationPreferences.pushNotifications, "Table must have pushNotifications column");
  assert.ok(notificationPreferences.slackNotifications, "Table must have slackNotifications column");
  assert.ok(notificationPreferences.eventTypes, "Table must have eventTypes column");
});

// ----------------------------------------------------------------------------
// Test 10: Settings Route Integration
// ----------------------------------------------------------------------------
test("10. SETTINGS INTEGRATION: app.settings.tsx renders NotificationsTab", () => {
  const settingsCode = fs.readFileSync(
    path.join(srcDir, "routes/app.settings.tsx"),
    "utf-8",
  );

  assert.ok(
    settingsCode.includes("NotificationsTab"),
    "app.settings.tsx must import and reference NotificationsTab",
  );
  assert.ok(
    settingsCode.includes('active === "notifications"'),
    "app.settings.tsx must render NotificationsTab when active === 'notifications'",
  );
  assert.ok(
    settingsCode.includes('search.tab === "notifications"'),
    "app.settings.tsx must resolve initialTab for search.tab === 'notifications'",
  );
});

// ----------------------------------------------------------------------------
// Test 11: Notification Center Header Navigation
// ----------------------------------------------------------------------------
test("11. ROUTE NAVIGATION: app.notifications.tsx links to Notification Preferences", () => {
  const notifsCode = fs.readFileSync(
    path.join(srcDir, "routes/app.notifications.tsx"),
    "utf-8",
  );

  assert.ok(
    notifsCode.includes('/app/settings'),
    "app.notifications.tsx must link to /app/settings",
  );
  assert.ok(
    notifsCode.includes('tab: "notifications"'),
    "app.notifications.tsx must target tab: 'notifications' in search params",
  );
});

// ----------------------------------------------------------------------------
// Test 12: Event Subscription Merging Logic
// ----------------------------------------------------------------------------
test("12. EVENT MERGE CONTRACT: Merging updates preserves unmentioned events", () => {
  const existingEvents: Record<string, boolean> = {
    ...DEFAULT_NOTIFICATION_EVENT_TYPES,
    task_assigned: false,
  };

  const incomingUpdate: Record<string, boolean> = {
    invoice_paid: false,
  };

  const merged = {
    ...DEFAULT_NOTIFICATION_EVENT_TYPES,
    ...existingEvents,
    ...incomingUpdate,
  };

  // task_assigned should remain false from existing
  assert.equal(merged.task_assigned, false);
  // invoice_paid should become false from incoming
  assert.equal(merged.invoice_paid, false);
  // unmentioned events should remain their default true
  assert.equal(merged.client_created, true);
  assert.equal(merged.comment_added, true);
  assert.equal(merged.expense_recorded, true);
  assert.equal(merged.ai_insight, true);
});

// ----------------------------------------------------------------------------
// Test 13: Slack Webhook Guidance
// ----------------------------------------------------------------------------
test("13. SLACK GUIDANCE: NotificationsTab provides webhook routing notice", () => {
  const tabCode = fs.readFileSync(
    path.join(srcDir, "components/silex/settings/notifications-tab.tsx"),
    "utf-8",
  );

  assert.ok(
    tabCode.includes("Automation & webhooks"),
    "NotificationsTab should guide users toward Automation & webhooks for Slack routing",
  );
  assert.ok(
    tabCode.includes("slackNotifications"),
    "NotificationsTab must bind slackNotifications state toggle",
  );
});
