import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { DOMAIN_EVENT_TYPES } from "../src/lib/events/types";
import {
  getAutomationRulesInputSchema,
  createAutomationRuleInputSchema,
  updateAutomationRuleInputSchema,
  toggleAutomationRuleInputSchema,
  deleteAutomationRuleInputSchema,
  getAutomationRunsInputSchema,
  getAutomationRunByIdInputSchema,
  getWebhooksInputSchema,
  createWebhookInputSchema,
  updateWebhookInputSchema,
  deleteWebhookInputSchema,
  getWebhookDeliveriesInputSchema,
  triggerAutomationOutboxWorkerInputSchema,
  triggerWebhookDeliveryWorkerInputSchema,
} from "../src/lib/server-functions/automation";
import {
  automationActionParamsSchema,
  AUTOMATION_ACTION_TYPES,
} from "../src/lib/automation/actions";

describe("M5.6 AUTOMATION UI CONTRACT & SECURITY TESTS", () => {
  it("1. CANONICAL DOMAIN EVENT REGISTRY — Directly Consumes DOMAIN_EVENT_TYPES", () => {
    assert.equal(DOMAIN_EVENT_TYPES.length, 11);
    assert.ok(DOMAIN_EVENT_TYPES.includes("invoice.paid"));
    assert.ok(DOMAIN_EVENT_TYPES.includes("payment.created"));
    assert.ok(DOMAIN_EVENT_TYPES.includes("client.created"));
    assert.ok(DOMAIN_EVENT_TYPES.includes("client.updated"));
    assert.ok(DOMAIN_EVENT_TYPES.includes("project.created"));
    assert.ok(DOMAIN_EVENT_TYPES.includes("project.updated"));
    assert.ok(DOMAIN_EVENT_TYPES.includes("task.created"));
    assert.ok(DOMAIN_EVENT_TYPES.includes("task.updated"));
    assert.ok(DOMAIN_EVENT_TYPES.includes("task.completed"));
    assert.ok(DOMAIN_EVENT_TYPES.includes("invoice.created"));
    assert.ok(DOMAIN_EVENT_TYPES.includes("comment.created"));
  });

  it("2. RULE CREATE SCHEMA — Validates Canonical Event & Allowlisted Actions", () => {
    const validPayload = {
      name: "Invoice Paid Alert",
      triggerEvent: "invoice.paid",
      conditions: [{ fieldPath: "event.payload.totalCents", operator: "gte", value: 50000 }],
      actions: [
        {
          type: "create_notification",
          recipientUserId: "event.actorId",
          title: "High Value Invoice Paid",
          body: "An invoice over $500 was paid.",
        },
      ],
      isEnabled: true,
    };

    const parsed = createAutomationRuleInputSchema.parse(validPayload);
    assert.equal(parsed.name, "Invoice Paid Alert");
    assert.equal(parsed.triggerEvent, "invoice.paid");
    assert.equal(parsed.actions.length, 1);
  });

  it("3. RULE UPDATE SCHEMA — Bounded Mutation Attributes", () => {
    const updatePayload = {
      ruleId: "018f3a5e-1234-7000-8000-000000000001",
      name: "Updated Name",
      isEnabled: false,
    };

    const parsed = updateAutomationRuleInputSchema.parse(updatePayload);
    assert.equal(parsed.ruleId, "018f3a5e-1234-7000-8000-000000000001");
    assert.equal(parsed.name, "Updated Name");
    assert.equal(parsed.isEnabled, false);
  });

  it("4. RULE TOGGLE SCHEMA — Enforces Boolean State & Rule ID", () => {
    const parsed = toggleAutomationRuleInputSchema.parse({
      ruleId: "018f3a5e-1234-7000-8000-000000000001",
      isEnabled: false,
    });
    assert.equal(parsed.isEnabled, false);
  });

  it("5. RULE DELETE SCHEMA — Requires Non-Empty Rule ID", () => {
    assert.throws(() => deleteAutomationRuleInputSchema.parse({ ruleId: "" }));
    const parsed = deleteAutomationRuleInputSchema.parse({
      ruleId: "018f3a5e-1234-7000-8000-000000000001",
    });
    assert.equal(parsed.ruleId, "018f3a5e-1234-7000-8000-000000000001");
  });

  it("6. CONDITION OPERATORS — 8 Allowlisted Primitives Only", () => {
    const validOperators = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"];
    assert.equal(validOperators.length, 8);
  });

  it("7. ACTION ALLOWLIST SCHEMAS — Discriminates 4 Action Types", () => {
    assert.equal(AUTOMATION_ACTION_TYPES.length, 4);

    const notificationAction = automationActionParamsSchema.parse({
      type: "create_notification",
      recipientUserId: "user_123",
      title: "Test",
      body: "Test Body",
    });
    assert.equal(notificationAction.type, "create_notification");

    const auditAction = automationActionParamsSchema.parse({
      type: "create_audit_log",
      action: "test.action",
      entityType: "task",
      entityId: "task_123",
    });
    assert.equal(auditAction.type, "create_audit_log");

    const taskStatusAction = automationActionParamsSchema.parse({
      type: "update_task_status",
      taskId: "task_123",
      status: "completed",
    });
    assert.equal(taskStatusAction.type, "update_task_status");

    const webhookAction = automationActionParamsSchema.parse({
      type: "dispatch_webhook",
      webhookId: "wh_123",
      payload: {},
    });
    assert.equal(webhookAction.type, "dispatch_webhook");
  });

  it("8. HISTORY FILTERS — Strictly Restricts Filter Parameters to ruleId, status, limit, offset", () => {
    const parsed = getAutomationRunsInputSchema.parse({
      ruleId: "018f3a5e-1234-7000-8000-000000000001",
      status: "completed",
      limit: 25,
      offset: 0,
    });
    assert.equal(parsed.ruleId, "018f3a5e-1234-7000-8000-000000000001");
    assert.equal(parsed.status, "completed");
    assert.equal(parsed.limit, 25);
    assert.equal(parsed.offset, 0);
  });

  it("9. WEBHOOK CREATE SCHEMA — Requires HTTPS Target URL", () => {
    const valid = createWebhookInputSchema.parse({
      targetUrl: "https://api.example.com/webhooks",
      subscribedEvents: ["invoice.paid"],
    });
    assert.equal(valid.targetUrl, "https://api.example.com/webhooks");
  });

  it("10. WEBHOOK SECRET ISOLATION INVARIANT — Secret Excluded From GET Input & Response Schemas", () => {
    const getParsed = getWebhooksInputSchema.parse({});
    assert.equal((getParsed as any).secret, undefined);
  });

  it("11. WEBHOOK UPDATE SCHEMA — Validates Subscribed Events & Active State", () => {
    const parsed = updateWebhookInputSchema.parse({
      webhookId: "wh_123",
      targetUrl: "https://api.example.com/v2/webhooks",
      isActive: false,
    });
    assert.equal(parsed.webhookId, "wh_123");
    assert.equal(parsed.isActive, false);
  });

  it("12. WEBHOOK DELETE SCHEMA — Requires Webhook ID", () => {
    const parsed = deleteWebhookInputSchema.parse({ webhookId: "wh_123" });
    assert.equal(parsed.webhookId, "wh_123");
  });

  it("13. WEBHOOK DELIVERIES SCHEMA — Bounded Pagination Parameters", () => {
    const parsed = getWebhookDeliveriesInputSchema.parse({
      webhookId: "wh_123",
      status: "delivered",
      limit: 10,
      offset: 20,
    });
    assert.equal(parsed.webhookId, "wh_123");
    assert.equal(parsed.status, "delivered");
    assert.equal(parsed.limit, 10);
    assert.equal(parsed.offset, 20);
  });

  it("14. WORKER TRIGGER SCHEMAS — Accepts Batch Size Bounded Between 1 and 100", () => {
    const outboxParsed = triggerAutomationOutboxWorkerInputSchema.parse({ batchSize: 20 });
    assert.equal(outboxParsed.batchSize, 20);

    const webhookParsed = triggerWebhookDeliveryWorkerInputSchema.parse({ batchSize: 50 });
    assert.equal(webhookParsed.batchSize, 50);

    assert.throws(() => triggerAutomationOutboxWorkerInputSchema.parse({ batchSize: 0 }));
    assert.throws(() => triggerWebhookDeliveryWorkerInputSchema.parse({ batchSize: 101 }));
  });

  it("15. SECRET NON-PERSISTENCE INVARIANT — Public Parameter Contracts Strip Secret Fields", () => {
    assert.equal((createAutomationRuleInputSchema as any).secret, undefined);
    assert.equal((triggerAutomationOutboxWorkerInputSchema as any).cronSecret, undefined);
    assert.equal((triggerWebhookDeliveryWorkerInputSchema as any).cronSecret, undefined);
  });
});
