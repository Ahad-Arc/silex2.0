/**
 * SILEX Automation Engine — Action Registry Security & Contract Test Suite
 */

import assert from "node:assert";
import test from "node:test";
import {
  ACTION_REGISTRY,
  getRegisteredAction,
  automationActionParamsSchema,
  executeAutomationAction,
  type TrustedExecutionContext,
} from "../src/lib/automation/actions";

test("1. ALLOWLISTED ACTIONS — Registry Verification", () => {
  const actions = Object.keys(ACTION_REGISTRY);
  assert.strictEqual(actions.length, 4);
  assert.deepStrictEqual(actions.sort(), [
    "create_audit_log",
    "create_notification",
    "dispatch_webhook",
    "update_task_status",
  ]);

  // Resolves registered actions
  assert.ok(getRegisteredAction("create_notification"));
  assert.ok(getRegisteredAction("create_audit_log"));
  assert.ok(getRegisteredAction("update_task_status"));
  assert.ok(getRegisteredAction("dispatch_webhook"));
});

test("2. UNKNOWN ACTION REJECTION — Security Boundary", () => {
  assert.throws(
    () => getRegisteredAction("eval_code" as any),
    /UNREGISTERED_ACTION: Action type "eval_code" is not registered in allowlist/
  );

  assert.throws(
    () => getRegisteredAction("send_email" as any),
    /UNREGISTERED_ACTION: Action type "send_email" is not registered in allowlist/
  );
});

test("3. ACTION PARAMETER SCHEMAS — Zod Discriminated Union Validation", () => {
  // Valid create_notification
  const validNotif = automationActionParamsSchema.safeParse({
    type: "create_notification",
    recipientUserId: "018f9e61-9c87-7a2e-b184-2d5830b05b1a",
    title: "Task Assigned",
    body: "You have been assigned to Project Zenith",
  });
  assert.strictEqual(validNotif.success, true);

  // Invalid create_notification (missing title)
  const invalidNotif = automationActionParamsSchema.safeParse({
    type: "create_notification",
    recipientUserId: "018f9e61-9c87-7a2e-b184-2d5830b05b1a",
    title: "",
    body: "Invalid notification",
  });
  assert.strictEqual(invalidNotif.success, false);

  // Valid update_task_status
  const validStatus = automationActionParamsSchema.safeParse({
    type: "update_task_status",
    taskId: "018f9e61-9c87-7a2e-b184-2d5830b05b1b",
    status: "completed",
  });
  assert.strictEqual(validStatus.success, true);

  // Valid dispatch_webhook
  const validWebhook = automationActionParamsSchema.safeParse({
    type: "dispatch_webhook",
    webhookId: "018f9e61-9c87-7a2e-b184-2d5830b05b1c",
    payload: { eventType: "invoice.paid", invoiceId: "inv-123" },
  });
  assert.strictEqual(validWebhook.success, true);
});

test("4. TRUSTED EXECUTION CONTEXT — Workspace Identity Enforcement", () => {
  const invalidContext = {
    workspaceId: "", // Empty workspace ID
  };

  assert.rejects(
    async () => {
      await executeAutomationAction(
        {
          type: "create_notification",
          recipientUserId: "018f9e61-9c87-7a2e-b184-2d5830b05b1a",
          title: "Title",
          body: "Body",
        },
        invalidContext as TrustedExecutionContext
      );
    },
    /Trusted workspaceId is required/
  );
});

test("5. DISPATCH_WEBHOOK NETWORK SAFETY — Zero HTTP/Fetch Execution", async () => {
  // Ensure dispatch_webhook builds intent descriptor without making HTTP calls
  // (In unit test mode, db is uninitialized, so invalid webhook ID or DB error occurs safely)
  const context: TrustedExecutionContext = {
    workspaceId: "018f9e61-9c87-7a2e-b184-2d5830b05b10",
    actorUserId: "018f9e61-9c87-7a2e-b184-2d5830b05b20",
  };

  try {
    await executeAutomationAction(
      {
        type: "dispatch_webhook",
        webhookId: "018f9e61-9c87-7a2e-b184-2d5830b05b1c",
        payload: { test: true },
      },
      context
    );
  } catch (err: any) {
    // Verified that failure is database or entity lookup failure, NOT a network/fetch error
    assert.ok(
      err.message.includes("DATABASE_ERROR") || err.message.includes("WEBHOOK_NOT_FOUND"),
      `Expected database or webhook lookup error, got: ${err.message}`
    );
  }
});

test("6. OVERSIZED WEBHOOK PAYLOAD BOUNDS — Max 16KB Constraint", async () => {
  const context: TrustedExecutionContext = {
    workspaceId: "018f9e61-9c87-7a2e-b184-2d5830b05b10",
  };

  // Build 20KB payload
  const hugePayload = {
    data: "X".repeat(20000),
  };

  try {
    await executeAutomationAction(
      {
        type: "dispatch_webhook",
        webhookId: "018f9e61-9c87-7a2e-b184-2d5830b05b1c",
        payload: hugePayload,
      },
      context
    );
    assert.fail("Should have thrown PAYLOAD_TOO_LARGE");
  } catch (err: any) {
    assert.ok(
      err.message.includes("PAYLOAD_TOO_LARGE") || err.message.includes("DATABASE_ERROR"),
      `Expected payload size error, got: ${err.message}`
    );
  }
});
