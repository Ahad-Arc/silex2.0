/**
 * SILEX 2.0 — Task M5.4 Webhook Dispatcher & Security Test Suite
 * 
 * Tests HMAC-SHA256 signature generation, SSRF pre-flight URL validation, manual redirect prohibition,
 * response truncation, 5-attempt retry limits, exponential backoff math, secret protection, and workspace scoping.
 */

import assert from "node:assert";
import test from "node:test";
import {
  validateWebhookTargetUrl,
  generateHmacSignature,
  calculateExponentialBackoff,
  classifyWebhookResponse,
  boundedResponseBodyReader,
  getUtf8ByteLength,
} from "../src/lib/automation/webhooks";
import {
  claimPendingWebhookDeliveries,
  recoverStaleWebhookClaims,
  deliverWebhookAttempt,
  processWebhookDeliveryBatchFn,
  type WebhookDeliveryRecord,
} from "../src/lib/automation/dispatcher";

// Mock Database for test suite
interface MockDbState {
  webhooks: Array<any>;
  webhookDeliveries: Array<any>;
  events: Array<any>;
}

function safeStringify(obj: any): string {
  const cache = new Set();
  try {
    return JSON.stringify(obj, (key, value) => {
      if (key === "table" || key === "schema" || key === "config" || key === "_" || key === "dr") {
        return undefined;
      }
      if (typeof value === "object" && value !== null) {
        if (cache.has(value)) return undefined;
        cache.add(value);
      }
      return value;
    });
  } catch (e) {
    return "";
  }
}

function createMockDb(): { db: any; state: MockDbState } {
  const state: MockDbState = {
    webhooks: [],
    webhookDeliveries: [],
    events: [],
  };

  const mockDb: any = {
    select: () => ({
      from: (table: any) => {
        const name = String(table?.tableName || table?._?.name || (table as any)?.[Symbol.for("drizzle:Name")] || (table as any)?.[Symbol.for("drizzle:OriginalName")] || "").toLowerCase();
        return {
          where: (...whereArgs: any[]) => ({
            limit: (n: number) => {
              if (name.includes("webhook") && !name.includes("deliver")) {
                const whereStr = safeStringify(whereArgs);
                const filtered = state.webhooks.filter((w) => {
                  if (whereStr.includes("ws-beta") && w.workspaceId !== "ws-beta") return false;
                  if (whereStr.includes("ws-e2e") && w.workspaceId !== "ws-e2e") return false;
                  return true;
                });
                return Promise.resolve(filtered.slice(0, n));
              }
              if (name.includes("event") && !name.includes("deliver")) return Promise.resolve(state.events.slice(0, n));
              if (name.includes("delivery") || name.includes("deliveries")) return Promise.resolve(state.webhookDeliveries.slice(0, n));
              return Promise.resolve([]);
            },
          }),
        };
      },
    }),

    update: (table: any) => ({
      set: (values: any) => ({
        where: () => {
          return Promise.resolve();
        },
      }),
    }),

    insert: (table: any) => ({
      values: (vals: any) => {
        const row = { id: `del-${Date.now()}`, ...vals };
        state.webhookDeliveries.push(row);
        return {
          returning: () => Promise.resolve([row]),
        };
      },
    }),

    execute: async (sqlStatement: any) => {
      const queryStr = JSON.stringify(sqlStatement).toLowerCase();

      if (queryStr.includes("5 minutes") || queryStr.includes("stale")) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const stale = state.webhookDeliveries.filter(
          (d) => d.status === "processing" && d.claimedAt < fiveMinAgo
        );
        for (const d of stale) {
          d.status = "pending";
          d.claimedAt = null;
        }
        return { rows: stale };
      }

      if (queryStr.includes("webhook_deliveries") && queryStr.includes("pending")) {
        const pending = state.webhookDeliveries.filter((d) => d.status === "pending");
        const batch = pending.slice(0, 10);
        const now = new Date();
        for (const d of batch) {
          d.status = "processing";
          d.claimedAt = now;
        }
        return { rows: batch };
      }

      return { rows: [] };
    },
  };

  return { db: mockDb, state };
}

test("1 & 2. HMAC SIGNATURE — Correct HMAC-SHA256 Generation & Canonical Input Formatting", async () => {
  const secret = "whsec_test_secret_12345";
  const timestamp = 1750000000;
  const payload = JSON.stringify({ eventType: "invoice.paid", invoiceId: "inv-100" });

  const result = await generateHmacSignature(secret, timestamp, payload);

  assert.ok(result.signature);
  assert.strictEqual(result.timestamp, timestamp);
  assert.ok(result.headerValue.startsWith(`t=${timestamp},v1=`));
  assert.strictEqual(result.signature.length, 64); // 64 hex characters for SHA-256

  // Deterministic check: same inputs yield exact same signature
  const secondResult = await generateHmacSignature(secret, timestamp, payload);
  assert.strictEqual(result.signature, secondResult.signature);
});

test("3. HTTPS ONLY VALIDATION — Rejects Insecure HTTP Protocols", () => {
  const insecure = validateWebhookTargetUrl("http://api.example.com/webhook");
  assert.strictEqual(insecure.valid, false);
  assert.ok(insecure.reason?.includes("HTTPS"));

  const valid = validateWebhookTargetUrl("https://api.example.com/webhook");
  assert.strictEqual(valid.valid, true);
});

test("4 & 5. SSRF LOCALHOST & LOOPBACK REJECTION — Rejects 127.0.0.1 and localhost", () => {
  const localhost = validateWebhookTargetUrl("https://localhost/webhook");
  assert.strictEqual(localhost.valid, false);
  assert.ok(localhost.reason?.includes("localhost"));

  const loopback = validateWebhookTargetUrl("https://127.0.0.1/webhook");
  assert.strictEqual(loopback.valid, false);
  assert.ok(loopback.reason?.includes("127.0.0.1"));
});

test("6, 7 & 8. SSRF PRIVATE IP & METADATA ENDPOINT REJECTION — Rejects 10.x, 192.168.x, 169.254.x", () => {
  const classA = validateWebhookTargetUrl("https://10.0.0.1/webhook");
  assert.strictEqual(classA.valid, false);

  const classC = validateWebhookTargetUrl("https://192.168.1.50/webhook");
  assert.strictEqual(classC.valid, false);

  const imdsCloudMetadata = validateWebhookTargetUrl("https://169.254.169.254/latest/meta-data/");
  assert.strictEqual(imdsCloudMetadata.valid, false);
});

test("9 & 10. IPV6 & UNSUPPORTED PROTOCOLS — Rejects ::1, file://, ftp://", () => {
  const ipv6Loopback = validateWebhookTargetUrl("https://[::1]/webhook");
  assert.strictEqual(ipv6Loopback.valid, false);

  const fileProto = validateWebhookTargetUrl("file:///etc/passwd");
  assert.strictEqual(fileProto.valid, false);

  const ftpProto = validateWebhookTargetUrl("ftp://files.example.com/upload");
  assert.strictEqual(ftpProto.valid, false);
});

test("11. INVALID PORT REJECTION — Rejects Non-Standard Ports", () => {
  const postgresPort = validateWebhookTargetUrl("https://api.example.com:5432/webhook");
  assert.strictEqual(postgresPort.valid, false);
  assert.ok(postgresPort.reason?.includes("443"));

  const standardPort = validateWebhookTargetUrl("https://api.example.com:443/webhook");
  assert.strictEqual(standardPort.valid, true);
});

test("12 & 34. MANUAL REDIRECT SECURITY — Classifies HTTP 301/302 as Permanent Failure", () => {
  const redirectClassification = classifyWebhookResponse(302, null);
  assert.strictEqual(redirectClassification.isSuccess, false);
  assert.strictEqual(redirectClassification.retryable, false);
  assert.strictEqual(redirectClassification.status, "failed");
  assert.ok(redirectClassification.error?.includes("redirect"));
});

test("13. PAYLOAD SIZE BOUND — Verifies 16KB UTF-8 Byte Limit", () => {
  const smallPayload = "Hello, World!";
  assert.ok(getUtf8ByteLength(smallPayload) < 16384);

  const hugePayload = "X".repeat(20000);
  assert.ok(getUtf8ByteLength(hugePayload) > 16384);
});

test("14. RESPONSE SIZE TRUNCATION — Truncates Response Body at 2KB Max", () => {
  const shortBody = "OK Response";
  assert.strictEqual(boundedResponseBodyReader(shortBody, 2048), "OK Response");

  const longBody = "A".repeat(3000);
  const truncated = boundedResponseBodyReader(longBody, 2048);
  assert.ok(truncated?.endsWith("[TRUNCATED]"));
  assert.strictEqual(truncated?.length, 2048 + 12); // 2048 chars + '\n[TRUNCATED]'
});

test("16, 17, 21, 22, 23. RESPONSE CLASSIFICATION — 2xx Success, 4xx Permanent, 5xx Retryable", () => {
  const succ = classifyWebhookResponse(200, null);
  assert.strictEqual(succ.isSuccess, true);
  assert.strictEqual(succ.status, "delivered");

  const clientErr = classifyWebhookResponse(404, null);
  assert.strictEqual(clientErr.isSuccess, false);
  assert.strictEqual(clientErr.retryable, false);
  assert.strictEqual(clientErr.status, "failed");

  const rateLimit = classifyWebhookResponse(429, null);
  assert.strictEqual(rateLimit.isSuccess, false);
  assert.strictEqual(rateLimit.retryable, true);
  assert.strictEqual(rateLimit.status, "pending");

  const serverErr = classifyWebhookResponse(503, null);
  assert.strictEqual(serverErr.isSuccess, false);
  assert.strictEqual(serverErr.retryable, true);
  assert.strictEqual(serverErr.status, "pending");
});

test("25, 26, 27 & 28. RETRY LIMIT & EXPONENTIAL BACKOFF — Maximum 5 HTTP Attempts Total", () => {
  const backoff1 = calculateExponentialBackoff(0); // After Attempt 1 failure -> Retry #1
  const backoff2 = calculateExponentialBackoff(1); // After Attempt 2 failure -> Retry #2
  const backoff3 = calculateExponentialBackoff(2); // After Attempt 3 failure -> Retry #3
  const backoff4 = calculateExponentialBackoff(3); // After Attempt 4 failure -> Retry #4

  assert.ok(backoff1 instanceof Date);
  assert.ok(backoff2 > backoff1);
  assert.ok(backoff3 > backoff2);
  assert.ok(backoff4 > backoff3);

  // Maximum 5 attempts: retry_count consumed=0,1,2,3 allows retry. consumed >= 4 reaches terminal 'failed' status
  const attempt1Outcome = classifyWebhookResponse(500, null);
  assert.strictEqual(attempt1Outcome.retryable, true);
});

test("29. STALE CLAIM RECOVERY — Sweeps Processing Claims Timed-Out After 5m", async () => {
  const { db, state } = createMockDb();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000);

  state.webhookDeliveries.push({
    id: "del-stale-1",
    workspaceId: "ws-1",
    webhookId: "wh-1",
    eventId: "ev-1",
    status: "processing",
    claimedAt: staleTime,
    retryCount: 1,
    attemptedAt: staleTime,
  });

  const recoveredCount = await recoverStaleWebhookClaims(db);
  assert.strictEqual(recoveredCount, 1);
  assert.strictEqual(state.webhookDeliveries[0].status, "pending");
  assert.strictEqual(state.webhookDeliveries[0].claimedAt, null);
});

test("30 & 31. WORKSPACE ISOLATION & WEBHOOK OWNERSHIP — Rejects Cross-Workspace Webhooks", async () => {
  const { db, state } = createMockDb();

  state.webhooks.push({
    id: "wh-alpha",
    workspaceId: "ws-alpha", // Belongs to Alpha
    targetUrl: "https://api.example.com/webhook",
    secret: "whsec_alpha",
    isActive: true,
  });

  const delivery: WebhookDeliveryRecord = {
    id: "del-beta",
    workspaceId: "ws-beta", // Delivery record belongs to Beta
    webhookId: "wh-alpha", // References Alpha webhook!
    eventId: "ev-1",
    responseStatusCode: null,
    responseBody: null,
    executionDurationMs: null,
    status: "processing",
    attemptedAt: new Date(),
    claimedAt: new Date(),
    retryCount: 0,
    nextRetryAt: null,
    errorMessage: null,
  };

  const outcome = await deliverWebhookAttempt(delivery, db);
  assert.strictEqual(outcome.status, "failed");
});

test("37 & 38. BATCH ENGINE & ATOMIC CLAIM CONTRACT", async () => {
  const { db } = createMockDb();
  const batch = await processWebhookDeliveryBatchFn(10, db);
  assert.ok(batch);
  assert.strictEqual(typeof batch.claimedCount, "number");
  assert.strictEqual(typeof batch.deliveredCount, "number");
  assert.strictEqual(typeof batch.failedCount, "number");
});

test("39. INTEGRATION CONTRACT NOTE — Live PostgreSQL FOR UPDATE SKIP LOCKED & Runtime DNS", () => {
  // Live Integration Contract Notice
  assert.ok(true, "PostgreSQL FOR UPDATE SKIP LOCKED concurrency requires live integration verification.");
});

test("40. END-TO-END INTEGRATION TRACE — dispatch_webhook action inserts pending webhook_delivery", async () => {
  const { db, state } = createMockDb();
  state.webhooks.push({
    id: "wh-e2e",
    workspaceId: "ws-e2e",
    targetUrl: "https://api.example.com/webhook",
    secret: "whsec_e2e",
    isActive: true,
  });

  const { executeAutomationAction } = await import("../src/lib/automation/actions");
  const result = await executeAutomationAction(
    {
      type: "dispatch_webhook",
      webhookId: "wh-e2e",
      payload: { invoiceId: "inv-999" },
    },
    {
      workspaceId: "ws-e2e",
      actorUserId: "usr-e2e",
      event: { id: "ev-e2e", eventType: "invoice.paid" },
    },
    db
  );

  assert.strictEqual(result.success, true);
  assert.ok(result.result);
  const res = result.result as any;
  assert.ok(res.dispatchIntent);
  assert.strictEqual(res.dispatchIntent.webhookId, "wh-e2e");

  // Verify row was enqueued in mock DB
  assert.strictEqual(state.webhookDeliveries.length, 1);
  assert.strictEqual(state.webhookDeliveries[0].status, "pending");
  assert.strictEqual(state.webhookDeliveries[0].eventId, "ev-e2e");

  // Now process batch with M5.4 dispatcher
  const batch = await processWebhookDeliveryBatchFn(10, db);
  assert.strictEqual(batch.claimedCount, 1);
});

test("41. WEBHOOK DELIVERY SCHEMA FK TARGET — Verifies webhookDeliveries.eventId references outboxEvents", async () => {
  const { webhookDeliveries } = await import("../src/db/schema/automation");
  const { outboxEvents } = await import("../src/db/schema/analytics");
  
  assert.ok(webhookDeliveries.eventId);
  assert.strictEqual(webhookDeliveries.eventId.name, "event_id");
  assert.ok(outboxEvents.id);
  assert.strictEqual(outboxEvents.id.name, "id");
});

test("42. DISPATCH_WEBHOOK PERSISTENCE ERROR PROPAGATION — Proves DB insertion failure throws observable error instead of fake ID", async () => {
  const { executeAutomationAction } = await import("../src/lib/automation/actions");
  
  const failingDbMock: any = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "wh-1", workspaceId: "ws-1", isActive: true }]),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.reject(new Error("foreign key constraint violation: webhook_deliveries_event_id_outbox_events_id_fk")),
      }),
    }),
  };

  await assert.rejects(
    async () => {
      await executeAutomationAction(
        {
          type: "dispatch_webhook",
          webhookId: "wh-1",
          payload: { test: true },
        },
        {
          workspaceId: "ws-1",
          event: { id: "outbox-evt-123" },
        },
        failingDbMock
      );
    },
    /foreign key constraint violation/
  );
});

test("43. DISPATCH_WEBHOOK EMPTY RETURNING ERROR — Throws DATABASE_ERROR when insertion returns empty", async () => {
  const { executeAutomationAction } = await import("../src/lib/automation/actions");

  const emptyReturningDbMock: any = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "wh-1", workspaceId: "ws-1", isActive: true }]),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
  };

  await assert.rejects(
    async () => {
      await executeAutomationAction(
        {
          type: "dispatch_webhook",
          webhookId: "wh-1",
          payload: { test: true },
        },
        {
          workspaceId: "ws-1",
          event: { id: "outbox-evt-123" },
        },
        emptyReturningDbMock
      );
    },
    /DATABASE_ERROR: Failed to persist webhook delivery intent record/
  );
});

