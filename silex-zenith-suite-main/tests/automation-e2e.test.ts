/**
 * SILEX 2.0 — Task M5.7 Consolidated Automation & Outbox E2E Integration Test Suite
 *
 * Verifies the complete real database lifecycle across application boundaries:
 * Event Publishing -> Outbox -> Worker Claiming -> Rule Matching -> Condition Evaluation ->
 * Action Execution -> Side Effect Verification -> Automation Runs Recording -> Idempotency Protection ->
 * Stale Claim Recovery -> Webhook Delivery Dispatcher -> Workspace Isolation -> Clean Database Teardown.
 *
 * CRITICAL TEST INVARIANTS:
 * 1. REAL database execution against PostgreSQL (no in-memory mock substitutions for E2E flow).
 * 2. Strict synthetic test isolation with unique RUN_ID identifiers.
 * 3. Never deletes non-test records.
 * 4. Deterministic teardown and post-suite DB verification (asserts 0 test artifacts remain).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert";
import test, { describe, before, after } from "node:test";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");

if (process.loadEnvFile && fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Ignore if already loaded
  }
}

// Unique synthetic run identifier
const RUN_ID = `m57_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

// Database & Application Module handles
let db: any;
let sql: any;
let eq: any;
let and: any;
let inArray: any;
let isNull: any;

let users: any;
let workspaces: any;
let workspaceMembers: any;
let tasks: any;
let events: any;
let outboxEvents: any;
let automationRules: any;
let automationRuns: any;
let webhooks: any;
let webhookDeliveries: any;
let notifications: any;
let auditLogs: any;
let idempotencyKeys: any;

let publishDomainEvent: any;
let claimPendingOutboxEvents: any;
let recoverStaleProcessingClaims: any;
let processOutboxBatchFn: any;
let executeWorkflowForOutboxEvent: any;
let claimPendingWebhookDeliveries: any;
let recoverStaleWebhookClaims: any;
let deliverWebhookAttempt: any;
let processWebhookDeliveryBatchFn: any;

// Test entity state trackers for reliable cleanup
const trackedWorkspaceIds: string[] = [];
const trackedUserIds: string[] = [];

let testUserA: any;
let testUserB: any;
let testWsA: any;
let testWsB: any;
let testTaskA: any;
let testWebhookA: any;

/**
 * Robust synthetic data cleanup ensuring zero orphaned test records
 */
async function cleanupSyntheticData() {
  if (!db) return;

  try {
    if (trackedWorkspaceIds.length > 0) {
      // 1. Delete dependent child records explicitly before workspace deletion
      await db.delete(automationRuns).where(inArray(automationRuns.workspaceId, trackedWorkspaceIds));
      await db.delete(automationRules).where(inArray(automationRules.workspaceId, trackedWorkspaceIds));
      await db.delete(webhookDeliveries).where(inArray(webhookDeliveries.workspaceId, trackedWorkspaceIds));
      await db.delete(webhooks).where(inArray(webhooks.workspaceId, trackedWorkspaceIds));
      await db.delete(outboxEvents).where(inArray(outboxEvents.workspaceId, trackedWorkspaceIds));
      await db.delete(events).where(inArray(events.workspaceId, trackedWorkspaceIds));
      await db.delete(notifications).where(inArray(notifications.workspaceId, trackedWorkspaceIds));
      await db.delete(auditLogs).where(inArray(auditLogs.workspaceId, trackedWorkspaceIds));
      await db.delete(idempotencyKeys).where(inArray(idempotencyKeys.workspaceId, trackedWorkspaceIds));
      await db.delete(tasks).where(inArray(tasks.workspaceId, trackedWorkspaceIds));
      await db.delete(workspaceMembers).where(inArray(workspaceMembers.workspaceId, trackedWorkspaceIds));

      // 2. Delete test workspaces
      await db.delete(workspaces).where(inArray(workspaces.id, trackedWorkspaceIds));
    }

    if (trackedUserIds.length > 0) {
      // 3. Delete test users
      await db.delete(users).where(inArray(users.id, trackedUserIds));
    }
  } catch (err) {
    console.error("[M5.7 Cleanup Warning]", err);
  }
}

// Global suite lifecycle
before(async () => {
  // Dynamically import database and application boundary modules
  const dbModule = await import("../src/db");
  db = dbModule.db;
  assert.ok(db, "Database client handle must be initialized for M5.7 E2E tests");

  const drizzleOrm = await import("drizzle-orm");
  sql = drizzleOrm.sql;
  eq = drizzleOrm.eq;
  and = drizzleOrm.and;
  inArray = drizzleOrm.inArray;
  isNull = drizzleOrm.isNull;

  const schema = await import("../src/db/schema");
  users = schema.users;
  workspaces = schema.workspaces;
  workspaceMembers = schema.workspaceMembers;
  tasks = schema.tasks;
  events = schema.events;
  outboxEvents = schema.outboxEvents;
  automationRules = schema.automationRules;
  automationRuns = schema.automationRuns;
  webhooks = schema.webhooks;
  webhookDeliveries = schema.webhookDeliveries;
  notifications = schema.notifications;
  auditLogs = schema.auditLogs;
  idempotencyKeys = schema.idempotencyKeys;

  const publisherModule = await import("../src/lib/events/publisher");
  publishDomainEvent = publisherModule.publishDomainEvent;

  const processorModule = await import("../src/lib/automation/processor");
  claimPendingOutboxEvents = processorModule.claimPendingOutboxEvents;
  recoverStaleProcessingClaims = processorModule.recoverStaleProcessingClaims;
  processOutboxBatchFn = processorModule.processOutboxBatchFn;

  const runnerModule = await import("../src/lib/automation/runner");
  executeWorkflowForOutboxEvent = runnerModule.executeWorkflowForOutboxEvent;

  const dispatcherModule = await import("../src/lib/automation/dispatcher");
  claimPendingWebhookDeliveries = dispatcherModule.claimPendingWebhookDeliveries;
  recoverStaleWebhookClaims = dispatcherModule.recoverStaleWebhookClaims;
  deliverWebhookAttempt = dispatcherModule.deliverWebhookAttempt;
  processWebhookDeliveryBatchFn = dispatcherModule.processWebhookDeliveryBatchFn;

  // 1. Create synthetic test users
  const [createdUserA] = await db
    .insert(users)
    .values({
      email: `${RUN_ID}_user_a@test.silex.internal`,
      fullName: `M5.7 Test User A (${RUN_ID})`,
      isActive: true,
    })
    .returning();
  testUserA = createdUserA;
  trackedUserIds.push(testUserA.id);

  const [createdUserB] = await db
    .insert(users)
    .values({
      email: `${RUN_ID}_user_b@test.silex.internal`,
      fullName: `M5.7 Test User B (${RUN_ID})`,
      isActive: true,
    })
    .returning();
  testUserB = createdUserB;
  trackedUserIds.push(testUserB.id);

  // 2. Create synthetic test workspaces
  const [createdWsA] = await db
    .insert(workspaces)
    .values({
      name: `M5.7 Workspace A ${RUN_ID}`,
      slug: `m57-ws-a-${RUN_ID}`,
      ownerId: testUserA.id,
      isActive: true,
    })
    .returning();
  testWsA = createdWsA;
  trackedWorkspaceIds.push(testWsA.id);

  const [createdWsB] = await db
    .insert(workspaces)
    .values({
      name: `M5.7 Workspace B ${RUN_ID}`,
      slug: `m57-ws-b-${RUN_ID}`,
      ownerId: testUserB.id,
      isActive: true,
    })
    .returning();
  testWsB = createdWsB;
  trackedWorkspaceIds.push(testWsB.id);

  // 3. Establish active workspace memberships
  await db.insert(workspaceMembers).values([
    {
      workspaceId: testWsA.id,
      userId: testUserA.id,
      role: "owner",
      status: "active",
    },
    {
      workspaceId: testWsB.id,
      userId: testUserB.id,
      role: "owner",
      status: "active",
    },
  ]);

  // 4. Create synthetic task in Workspace A for status update action
  const [createdTask] = await db
    .insert(tasks)
    .values({
      workspaceId: testWsA.id,
      title: `E2E Test Task ${RUN_ID}`,
      status: "todo",
      createdBy: testUserA.id,
    })
    .returning();
  testTaskA = createdTask;

  // 5. Create synthetic webhook in Workspace A for webhook action
  const [createdWebhook] = await db
    .insert(webhooks)
    .values({
      workspaceId: testWsA.id,
      targetUrl: "https://example.com/e2e-webhook-endpoint",
      secret: `sec_${RUN_ID}_0123456789abcdef`,
      subscribedEvents: ["invoice.created"],
      isActive: true,
    })
    .returning();
  testWebhookA = createdWebhook;
});

after(async () => {
  // Always execute cleanup even after test assertions
  await cleanupSyntheticData();

  // Close database connection pool to allow clean Node process exit
  const globalConn = (globalThis as any).conn;
  if (globalConn && typeof globalConn.end === "function") {
    await globalConn.end({ timeout: 5 });
  }
});

// ============================================================================
// TEST SCENARIOS
// ============================================================================

test("M5.7.1 — DOMAIN EVENT PERSISTENCE: Event enters outbox as pending with transactional integrity", async () => {
  const aggregateId = crypto.randomUUID();
  const invoiceId = crypto.randomUUID();

  const { domainEvent, outboxEvent } = await publishDomainEvent(
    {
      workspaceId: testWsA.id,
      aggregateType: "invoice",
      aggregateId,
      eventType: "invoice.created",
      actorId: testUserA.id,
      payload: {
        invoiceId,
        invoiceNumber: `INV-${RUN_ID}-01`,
        clientId: crypto.randomUUID(),
        totalCents: 5000,
        currency: "USD",
        issueDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        status: "draft",
        createdBy: testUserA.id,
      },
    },
    db
  );

  assert.ok(outboxEvent.id, "Outbox event ID must be generated");
  assert.strictEqual(outboxEvent.status, "pending", "Outbox event must initially be 'pending'");
  assert.strictEqual(outboxEvent.retryCount, 0, "Outbox event retryCount must start at 0");
  assert.strictEqual(outboxEvent.workspaceId, testWsA.id, "Outbox event must record workspace ID");
  assert.strictEqual(outboxEvent.actorId, testUserA.id, "Outbox event must record actor user ID");

  // Query database directly to confirm persistence
  const [persistedOutboxRow] = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.id, outboxEvent.id))
    .limit(1);

  assert.ok(persistedOutboxRow, "Outbox event row must exist in database");
  assert.strictEqual(persistedOutboxRow.status, "pending");
  assert.strictEqual(persistedOutboxRow.retryCount, 0);
  assert.strictEqual(persistedOutboxRow.claimedAt, null);
  assert.strictEqual(persistedOutboxRow.processedAt, null);

  // Confirm domain event log was also persisted
  const [persistedDomainEventRow] = await db
    .select()
    .from(events)
    .where(eq(events.id, domainEvent.id))
    .limit(1);

  assert.ok(persistedDomainEventRow, "Domain event log row must exist in database");
  assert.strictEqual(persistedDomainEventRow.eventType, "invoice.created");
});

test("M5.7.2 — FULL E2E WORKFLOW EXECUTION: Worker claims event, executes positive rule, produces side effects & records automation_runs", async () => {
  // 1. Create matching automation rule in Workspace A with condition totalCents >= 20000
  const [rule] = await db
    .insert(automationRules)
    .values({
      workspaceId: testWsA.id,
      name: `Positive Condition Rule ${RUN_ID}`,
      triggerEvent: "invoice.created",
      isEnabled: true,
      conditions: [
        {
          field: "totalCents",
          operator: "gte",
          value: 20000,
        },
      ],
      actions: [
        {
          type: "create_notification",
          recipientUserId: testUserA.id,
          title: `High Value Invoice Alert (${RUN_ID})`,
          body: "A high-value invoice was registered and processed.",
        },
        {
          type: "create_audit_log",
          action: "invoice.automation_audit",
          entityType: "invoice",
          entityId: crypto.randomUUID(),
          newValues: { automated: true, runId: RUN_ID },
        },
        {
          type: "update_task_status",
          taskId: testTaskA.id,
          status: "completed",
        },
        {
          type: "dispatch_webhook",
          webhookId: testWebhookA.id,
          payload: { runId: RUN_ID, eventType: "invoice.created" },
        },
      ],
      createdBy: testUserA.id,
    })
    .returning();

  // 2. Publish domain event with totalCents = 75000 (satisfies condition)
  const aggregateId = crypto.randomUUID();
  const invoiceId = crypto.randomUUID();

  const { outboxEvent } = await publishDomainEvent(
    {
      workspaceId: testWsA.id,
      aggregateType: "invoice",
      aggregateId,
      eventType: "invoice.created",
      actorId: testUserA.id,
      payload: {
        invoiceId,
        invoiceNumber: `INV-${RUN_ID}-POS`,
        clientId: crypto.randomUUID(),
        totalCents: 75000,
        currency: "USD",
        issueDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        status: "draft",
        createdBy: testUserA.id,
      },
    },
    db
  );

  // 3. Trigger worker batch processing
  const batchResult = await processOutboxBatchFn(10, db);
  assert.ok(batchResult.claimedCount >= 1, "Batch processor must claim at least 1 pending event");

  // 4. Verify outbox event transitioned to 'processed'
  const [updatedOutboxRow] = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.id, outboxEvent.id))
    .limit(1);

  assert.ok(updatedOutboxRow, "Updated outbox row must exist");
  assert.strictEqual(updatedOutboxRow.status, "processed", "Outbox status must be 'processed'");
  assert.ok(updatedOutboxRow.processedAt, "processedAt timestamp must be recorded");

  // 5. Verify automation_runs recorded execution
  const [runRecord] = await db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.workspaceId, testWsA.id),
        eq(automationRuns.ruleId, rule.id),
        eq(automationRuns.outboxEventId, outboxEvent.id)
      )
    )
    .limit(1);

  assert.ok(runRecord, "automation_runs record must exist for this rule and event");
  assert.strictEqual(runRecord.status, "completed", "Run status must be 'completed'");
  assert.ok(Array.isArray(runRecord.logs), "Run logs must be an array");
  assert.ok(runRecord.logs.length > 0, "Run logs must contain execution entries");

  // 6. Verify side effect 1: Notification created
  const notifRows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, testWsA.id),
        eq(notifications.recipientUserId, testUserA.id),
        eq(notifications.title, `High Value Invoice Alert (${RUN_ID})`)
      )
    );
  assert.strictEqual(notifRows.length, 1, "Exactly one notification must be generated by action");

  // 7. Verify side effect 2: Audit log created
  const auditRows = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.workspaceId, testWsA.id),
        eq(auditLogs.action, "invoice.automation_audit")
      )
    );
  assert.ok(auditRows.length >= 1, "Audit log must be created by action");

  // 8. Verify side effect 3: Task status updated
  const [updatedTask] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, testTaskA.id))
    .limit(1);
  assert.strictEqual(updatedTask.status, "completed", "Task status must be updated to 'completed'");
  assert.ok(updatedTask.completedAt, "Task completedAt timestamp must be set");

  // 9. Verify side effect 4: Webhook delivery enqueued
  const deliveryRows = await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.workspaceId, testWsA.id),
        eq(webhookDeliveries.webhookId, testWebhookA.id),
        eq(webhookDeliveries.eventId, outboxEvent.id)
      )
    );
  assert.strictEqual(deliveryRows.length, 1, "Webhook delivery intent must be enqueued");
  assert.strictEqual(deliveryRows[0].status, "pending");
  assert.strictEqual(deliveryRows[0].eventId, outboxEvent.id, "webhook_deliveries.event_id must match outbox_events.id");
});

test("M5.7.3 — CONDITION-NEGATIVE RULE: False condition skips action execution and marks run 'skipped'", async () => {
  // 1. Create rule with condition totalCents >= 1,000,000 (false for 50000)
  const [rule] = await db
    .insert(automationRules)
    .values({
      workspaceId: testWsA.id,
      name: `Negative Condition Rule ${RUN_ID}`,
      triggerEvent: "invoice.created",
      isEnabled: true,
      conditions: [
        {
          field: "totalCents",
          operator: "gte",
          value: 1000000,
        },
      ],
      actions: [
        {
          type: "create_notification",
          recipientUserId: testUserA.id,
          title: `SHOULD NEVER EXIST (${RUN_ID})`,
          body: "This should not be delivered.",
        },
      ],
      createdBy: testUserA.id,
    })
    .returning();

  // 2. Publish event with totalCents = 50000
  const { outboxEvent } = await publishDomainEvent(
    {
      workspaceId: testWsA.id,
      aggregateType: "invoice",
      aggregateId: crypto.randomUUID(),
      eventType: "invoice.created",
      actorId: testUserA.id,
      payload: {
        invoiceId: crypto.randomUUID(),
        invoiceNumber: `INV-${RUN_ID}-NEG`,
        clientId: crypto.randomUUID(),
        totalCents: 50000,
        currency: "USD",
        issueDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        status: "draft",
        createdBy: testUserA.id,
      },
    },
    db
  );

  // 3. Process outbox event directly through workflow runner boundary
  const outcome = await executeWorkflowForOutboxEvent(outboxEvent, db);
  assert.strictEqual(outcome.status, "processed");
  assert.ok(outcome.skippedRulesCount >= 1, "Outcome must record at least 1 skipped rule");

  // 4. Verify automation_runs status is 'skipped'
  const [runRecord] = await db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.workspaceId, testWsA.id),
        eq(automationRuns.ruleId, rule.id),
        eq(automationRuns.outboxEventId, outboxEvent.id)
      )
    )
    .limit(1);

  assert.ok(runRecord, "automation_runs record must exist");
  assert.strictEqual(runRecord.status, "skipped", "Run status must be 'skipped'");

  // 5. Verify NO side effect notification was created
  const notifRows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, testWsA.id),
        eq(notifications.title, `SHOULD NEVER EXIST (${RUN_ID})`)
      )
    );
  assert.strictEqual(notifRows.length, 0, "Condition-negative rule must NEVER produce side effects");
});

test("M5.7.4 — RULE-LEVEL IDEMPOTENCY: Re-processing identical event prevents duplicate rule execution", async () => {
  // 1. Create rule with notification action
  const [rule] = await db
    .insert(automationRules)
    .values({
      workspaceId: testWsA.id,
      name: `Idempotency Test Rule ${RUN_ID}`,
      triggerEvent: "client.created",
      isEnabled: true,
      conditions: [],
      actions: [
        {
          type: "create_notification",
          recipientUserId: testUserA.id,
          title: `Client Created Once (${RUN_ID})`,
          body: "Unique notification per client event.",
        },
      ],
      createdBy: testUserA.id,
    })
    .returning();

  // 2. Publish client.created domain event
  const { outboxEvent } = await publishDomainEvent(
    {
      workspaceId: testWsA.id,
      aggregateType: "client",
      aggregateId: crypto.randomUUID(),
      eventType: "client.created",
      actorId: testUserA.id,
      payload: {
        clientId: crypto.randomUUID(),
        companyName: `Acme Corp ${RUN_ID}`,
        status: "active",
        createdBy: testUserA.id,
      },
    },
    db
  );

  // 3. First execution pass
  const outcome1 = await executeWorkflowForOutboxEvent(outboxEvent, db);
  assert.strictEqual(outcome1.status, "processed");
  assert.strictEqual(outcome1.executedRunsCount, 1);
  assert.strictEqual(outcome1.skippedRulesCount, 0);

  // Count automation runs and notifications after first pass
  const runsPass1 = await db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.workspaceId, testWsA.id),
        eq(automationRuns.ruleId, rule.id),
        eq(automationRuns.outboxEventId, outboxEvent.id)
      )
    );
  assert.strictEqual(runsPass1.length, 1, "First pass must record exactly 1 automation_runs entry");

  const notifsPass1 = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, testWsA.id),
        eq(notifications.title, `Client Created Once (${RUN_ID})`)
      )
    );
  assert.strictEqual(notifsPass1.length, 1, "First pass must create exactly 1 notification");

  // 4. Second execution pass with the EXACT same outbox event
  const outcome2 = await executeWorkflowForOutboxEvent(outboxEvent, db);
  assert.strictEqual(outcome2.status, "processed");
  assert.strictEqual(outcome2.executedRunsCount, 0, "Second pass must execute 0 runs due to idempotency");
  assert.strictEqual(outcome2.skippedRulesCount, 1, "Second pass must skip 1 rule due to idempotency reservation");

  // 5. Verify NO duplicate records in automation_runs or notifications
  const runsPass2 = await db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.workspaceId, testWsA.id),
        eq(automationRuns.ruleId, rule.id),
        eq(automationRuns.outboxEventId, outboxEvent.id)
      )
    );
  assert.strictEqual(runsPass2.length, 1, "Runs count must remain 1 after replay");

  const notifsPass2 = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, testWsA.id),
        eq(notifications.title, `Client Created Once (${RUN_ID})`)
      )
    );
  assert.strictEqual(notifsPass2.length, 1, "Notification count must remain 1 after replay (NO duplication)");

  // 6. Verify idempotency key is persisted in database
  const expectedKey = `auto_run:${rule.id}:${outboxEvent.id}`;
  const [persistedKey] = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.workspaceId, testWsA.id),
        eq(idempotencyKeys.key, expectedKey)
      )
    )
    .limit(1);

  assert.ok(persistedKey, "Idempotency key record must exist in idempotency_keys table");
  assert.strictEqual(persistedKey.status, "completed");
});

test("M5.7.5 — STALE CLAIM RECOVERY: Sweeps timed-out processing claims and manages retry bounds", async () => {
  const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);

  // Case A: Stale event with retry_count = 0 -> Recovers back to 'pending' with retry_count = 1
  const [staleEventRecoverable] = await db
    .insert(outboxEvents)
    .values({
      workspaceId: testWsA.id,
      aggregateType: "invoice",
      aggregateId: crypto.randomUUID(),
      eventType: "invoice.created",
      actorId: testUserA.id,
      payload: { test: true, runId: RUN_ID },
      status: "processing",
      claimedAt: sixMinutesAgo,
      retryCount: 0,
    })
    .returning();

  // Case B: Stale event with retry_count = 3 -> Marks as 'failed' (exhausted retries)
  const [staleEventExhausted] = await db
    .insert(outboxEvents)
    .values({
      workspaceId: testWsA.id,
      aggregateType: "invoice",
      aggregateId: crypto.randomUUID(),
      eventType: "invoice.created",
      actorId: testUserA.id,
      payload: { test: true, runId: RUN_ID },
      status: "processing",
      claimedAt: sixMinutesAgo,
      retryCount: 3,
    })
    .returning();

  // Run the real stale claim recovery query implementation
  const sweepResult = await recoverStaleProcessingClaims(db);
  assert.ok(sweepResult.recoveredCount >= 1, "At least 1 stale event must be recovered");
  assert.ok(sweepResult.exhaustedCount >= 1, "At least 1 exhausted event must be marked failed");

  // Verify Case A row in database
  const [recoveredRow] = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.id, staleEventRecoverable.id))
    .limit(1);

  assert.strictEqual(recoveredRow.status, "pending", "Recoverable row status must revert to 'pending'");
  assert.strictEqual(recoveredRow.claimedAt, null, "claimedAt must be cleared");
  assert.strictEqual(recoveredRow.retryCount, 1, "retryCount must be incremented to 1");
  assert.ok(recoveredRow.errorMessage?.includes("Stale processing claim timed out"), "Error message must record crash suspicion");

  // Verify Case B row in database
  const [exhaustedRow] = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.id, staleEventExhausted.id))
    .limit(1);

  assert.strictEqual(exhaustedRow.status, "failed", "Exhausted row status must transition to 'failed'");
  assert.ok(exhaustedRow.processedAt, "processedAt must be populated");
  assert.ok(exhaustedRow.errorMessage?.includes("Exhausted retries"), "Error message must reflect retry exhaustion");
});

test("M5.7.6 — WEBHOOK DELIVERY DISPATCHER: SSRF protection, stale delivery recovery & deterministic retry behavior", async () => {
  // 1. Setup outbox event to satisfy foreign key requirement
  const [dummyOutbox] = await db
    .insert(outboxEvents)
    .values({
      workspaceId: testWsA.id,
      aggregateType: "invoice",
      aggregateId: crypto.randomUUID(),
      eventType: "invoice.created",
      payload: { test: true },
      status: "processed",
    })
    .returning();

  // Case A: SSRF Pre-flight Rejection (Localhost / Loopback URL)
  const [ssrfWebhook] = await db
    .insert(webhooks)
    .values({
      workspaceId: testWsA.id,
      targetUrl: "https://127.0.0.1/malicious-hook",
      secret: "sec_ssrf_test_0123456789abcdef",
      subscribedEvents: ["invoice.created"],
      isActive: true,
    })
    .returning();

  const [ssrfDelivery] = await db
    .insert(webhookDeliveries)
    .values({
      workspaceId: testWsA.id,
      webhookId: ssrfWebhook.id,
      eventId: dummyOutbox.id,
      status: "pending",
    })
    .returning();

  // Attempt delivery
  const ssrfOutcome = await deliverWebhookAttempt(
    {
      ...ssrfDelivery,
      attemptedAt: new Date(ssrfDelivery.attemptedAt),
      claimedAt: null,
      nextRetryAt: null,
      responseStatusCode: null,
      responseBody: null,
      executionDurationMs: null,
      errorMessage: null,
    },
    db
  );

  assert.strictEqual(ssrfOutcome.status, "failed", "SSRF target must fail immediately");

  const [persistedSsrfDelivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, ssrfDelivery.id))
    .limit(1);
  assert.strictEqual(persistedSsrfDelivery.status, "failed");
  assert.ok(
    persistedSsrfDelivery.errorMessage?.includes("SECURITY REJECTION") ||
    persistedSsrfDelivery.errorMessage?.includes("SSRF"),
    "Delivery error must cite SSRF security rejection"
  );

  // Case B: Stale Webhook Delivery Claim Recovery
  const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
  const [staleDelivery] = await db
    .insert(webhookDeliveries)
    .values({
      workspaceId: testWsA.id,
      webhookId: testWebhookA.id,
      eventId: dummyOutbox.id,
      status: "processing",
      claimedAt: sixMinutesAgo,
    })
    .returning();

  const recoveredStaleCount = await recoverStaleWebhookClaims(db);
  assert.ok(recoveredStaleCount >= 1, "Stale delivery must be recovered");

  const [persistedStaleDelivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, staleDelivery.id))
    .limit(1);
  assert.strictEqual(persistedStaleDelivery.status, "pending", "Stale delivery must revert to 'pending'");
  assert.strictEqual(persistedStaleDelivery.claimedAt, null, "claimedAt must be cleared");

  // Case C: Deterministic Network Failure & Retry Scheduling (Non-routable endpoint)
  const [nonRoutableWebhook] = await db
    .insert(webhooks)
    .values({
      workspaceId: testWsA.id,
      targetUrl: "https://nonexistent-webhook-test-domain-999.org/endpoint",
      secret: "sec_retry_test_0123456789abcdef",
      subscribedEvents: ["invoice.created"],
      isActive: true,
    })
    .returning();

  // Attempt 1: retryCount starts at 0 -> should increment to 1 and schedule nextRetryAt
  const [retryableDelivery] = await db
    .insert(webhookDeliveries)
    .values({
      workspaceId: testWsA.id,
      webhookId: nonRoutableWebhook.id,
      eventId: dummyOutbox.id,
      status: "pending",
      retryCount: 0,
    })
    .returning();

  const attempt1Outcome = await deliverWebhookAttempt(
    {
      ...retryableDelivery,
      attemptedAt: new Date(retryableDelivery.attemptedAt),
      claimedAt: null,
      nextRetryAt: null,
      responseStatusCode: null,
      responseBody: null,
      executionDurationMs: null,
      errorMessage: null,
    },
    db
  );

  assert.strictEqual(attempt1Outcome.status, "pending", "Network error on initial attempt must remain pending for retry");

  const [persistedAttempt1] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, retryableDelivery.id))
    .limit(1);

  assert.strictEqual(persistedAttempt1.status, "pending");
  assert.strictEqual(persistedAttempt1.retryCount, 1, "retryCount must increment to 1");
  assert.ok(persistedAttempt1.nextRetryAt, "nextRetryAt must be populated");

  // Attempt 2: Delivery at retry limit (retryCount = 4) -> should transition to 'failed' on 5th attempt
  const [exhaustedDelivery] = await db
    .insert(webhookDeliveries)
    .values({
      workspaceId: testWsA.id,
      webhookId: nonRoutableWebhook.id,
      eventId: dummyOutbox.id,
      status: "pending",
      retryCount: 4, // 4 retries already consumed -> this attempt is #5 (final)
    })
    .returning();

  const attempt5Outcome = await deliverWebhookAttempt(
    {
      ...exhaustedDelivery,
      attemptedAt: new Date(exhaustedDelivery.attemptedAt),
      claimedAt: null,
      nextRetryAt: null,
      responseStatusCode: null,
      responseBody: null,
      executionDurationMs: null,
      errorMessage: null,
    },
    db
  );

  assert.strictEqual(attempt5Outcome.status, "failed", "Final attempt failure must transition status to 'failed'");

  const [persistedExhaustedDelivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, exhaustedDelivery.id))
    .limit(1);

  assert.strictEqual(persistedExhaustedDelivery.status, "failed");
  assert.strictEqual(persistedExhaustedDelivery.retryCount, 5, "retryCount must reach 5");
});

test("M5.7.7 — WORKSPACE ISOLATION: Workspace A rules are NEVER executed for Workspace B events", async () => {
  // 1. Create automation rule in Workspace A for trigger 'task.created'
  const [ruleWsA] = await db
    .insert(automationRules)
    .values({
      workspaceId: testWsA.id,
      name: `Workspace A Task Rule ${RUN_ID}`,
      triggerEvent: "task.created",
      isEnabled: true,
      conditions: [],
      actions: [
        {
          type: "create_notification",
          recipientUserId: testUserA.id,
          title: `CROSS WORKSPACE LEAK ALERT (${RUN_ID})`,
          body: "This notification must NEVER be created from Workspace B events.",
        },
      ],
      createdBy: testUserA.id,
    })
    .returning();

  // 2. Publish domain event in Workspace B for trigger 'task.created'
  const { outboxEvent: outboxEventB } = await publishDomainEvent(
    {
      workspaceId: testWsB.id, // Event strictly belongs to Workspace B
      aggregateType: "task",
      aggregateId: crypto.randomUUID(),
      eventType: "task.created",
      actorId: testUserB.id,
      payload: {
        taskId: crypto.randomUUID(),
        title: `Workspace B Private Task ${RUN_ID}`,
        priority: "high",
        status: "todo",
        createdBy: testUserB.id,
      },
    },
    db
  );

  assert.strictEqual(outboxEventB.workspaceId, testWsB.id);

  // 3. Process Workspace B outbox event through execution engine
  const outcome = await executeWorkflowForOutboxEvent(outboxEventB, db);
  assert.strictEqual(outcome.status, "processed");
  assert.strictEqual(outcome.matchedRulesCount, 0, "Zero rules must match because rule belongs to Workspace A, not Workspace B");
  assert.strictEqual(outcome.executedRunsCount, 0);

  // 4. Verify no automation_runs were recorded in Workspace A for Workspace B's event
  const runsWsA = await db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.workspaceId, testWsA.id),
        eq(automationRuns.outboxEventId, outboxEventB.id)
      )
    );
  assert.strictEqual(runsWsA.length, 0, "Workspace A must have zero runs for Workspace B event");

  // 5. Verify no notifications were created in Workspace A
  const notifsWsA = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, testWsA.id),
        eq(notifications.title, `CROSS WORKSPACE LEAK ALERT (${RUN_ID})`)
      )
    );
  assert.strictEqual(notifsWsA.length, 0, "No cross-tenant notifications may be triggered");
});

test("M5.7.8 — POST-TEST CLEANUP VERIFICATION: Zero synthetic test artifacts remain in database", async () => {
  // Perform thorough cleanup
  await cleanupSyntheticData();

  // Verify zero synthetic workspaces remain
  const remainingWorkspaces = await db
    .select()
    .from(workspaces)
    .where(inArray(workspaces.id, trackedWorkspaceIds));
  assert.strictEqual(remainingWorkspaces.length, 0, "All synthetic workspaces must be deleted");

  // Verify zero synthetic users remain
  const remainingUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, trackedUserIds));
  assert.strictEqual(remainingUsers.length, 0, "All synthetic users must be deleted");

  // Verify zero synthetic outbox events remain
  const remainingOutbox = await db
    .select()
    .from(outboxEvents)
    .where(inArray(outboxEvents.workspaceId, trackedWorkspaceIds));
  assert.strictEqual(remainingOutbox.length, 0, "All synthetic outbox events must be deleted");

  // Verify zero synthetic automation rules remain
  const remainingRules = await db
    .select()
    .from(automationRules)
    .where(inArray(automationRules.workspaceId, trackedWorkspaceIds));
  assert.strictEqual(remainingRules.length, 0, "All synthetic automation rules must be deleted");

  // Verify zero synthetic automation runs remain
  const remainingRuns = await db
    .select()
    .from(automationRuns)
    .where(inArray(automationRuns.workspaceId, trackedWorkspaceIds));
  assert.strictEqual(remainingRuns.length, 0, "All synthetic automation runs must be deleted");

  // Verify zero synthetic idempotency keys remain
  const remainingKeys = await db
    .select()
    .from(idempotencyKeys)
    .where(inArray(idempotencyKeys.workspaceId, trackedWorkspaceIds));
  assert.strictEqual(remainingKeys.length, 0, "All synthetic idempotency keys must be deleted");

  // Verify zero synthetic webhooks remain
  const remainingWebhooks = await db
    .select()
    .from(webhooks)
    .where(inArray(webhooks.workspaceId, trackedWorkspaceIds));
  assert.strictEqual(remainingWebhooks.length, 0, "All synthetic webhooks must be deleted");

  // Verify zero synthetic webhook deliveries remain
  const remainingDeliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(inArray(webhookDeliveries.workspaceId, trackedWorkspaceIds));
  assert.strictEqual(remainingDeliveries.length, 0, "All synthetic webhook deliveries must be deleted");

  // Verify zero synthetic notifications remain
  const remainingNotifs = await db
    .select()
    .from(notifications)
    .where(inArray(notifications.workspaceId, trackedWorkspaceIds));
  assert.strictEqual(remainingNotifs.length, 0, "All synthetic notifications must be deleted");

  // Verify zero synthetic audit logs remain
  const remainingAuditLogs = await db
    .select()
    .from(auditLogs)
    .where(inArray(auditLogs.workspaceId, trackedWorkspaceIds));
  assert.strictEqual(remainingAuditLogs.length, 0, "All synthetic audit logs must be deleted");
});
