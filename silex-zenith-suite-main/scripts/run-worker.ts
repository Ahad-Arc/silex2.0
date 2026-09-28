/**
 * SILEX 2.0 — Local Development & CLI Automation Worker Runner
 *
 * Invokes outbox processing and webhook delivery batch processing for local development,
 * CI/CD pipelines, or self-hosted environments without external SaaS cron services.
 *
 * Usage:
 *   npx tsx scripts/run-worker.ts
 *   npm run worker
 */

import * as fs from "node:fs";
import * as path from "node:path";

// 1. Auto-load .env BEFORE importing database or server modules
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    for (const line of envConfig.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...vals] = trimmed.split("=");
        if (key && !process.env[key.trim()]) {
          process.env[key.trim()] = vals.join("=").trim();
        }
      }
    }
  }
} catch {
  // Ignore if .env is missing or invalid
}

// 2. Dynamic import after environment initialization
export async function runLocalWorkerBatch() {
  console.log(`[LOCAL_WORKER] Triggering automation worker batch execution at ${new Date().toISOString()}...`);

  const { db } = await import("../src/db");
  const { processOutboxBatchFn } = await import("../src/lib/automation/processor");
  const { processWebhookDeliveryBatchFn } = await import("../src/lib/automation/dispatcher");

  if (!db) {
    console.warn("[LOCAL_WORKER] Notice: Database connection uninitialized (no DATABASE_URL set). Running in dry-run mode.");
    return {
      outbox: { claimedCount: 0, processedCount: 0, failedCount: 0, recoveredStaleCount: 0 },
      webhooks: { claimedCount: 0, deliveredCount: 0, failedCount: 0, retriedCount: 0, recoveredStaleCount: 0 },
    };
  }

  try {
    const outboxResult = await processOutboxBatchFn(10, db);
    console.log(
      `[LOCAL_WORKER] Outbox Processor: Claimed ${outboxResult.claimedCount}, Processed ${outboxResult.processedCount}, Failed ${outboxResult.failedCount}, Recovered Stale ${outboxResult.recoveredStaleCount}`
    );

    const webhookResult = await processWebhookDeliveryBatchFn(10, db);
    console.log(
      `[LOCAL_WORKER] Webhook Dispatcher: Claimed ${webhookResult.claimedCount}, Delivered ${webhookResult.deliveredCount}, Failed ${webhookResult.failedCount}, Retried ${webhookResult.retriedCount}, Recovered Stale ${webhookResult.recoveredStaleCount}`
    );

    return { outbox: outboxResult, webhooks: webhookResult };
  } catch (err: any) {
    console.error("[LOCAL_WORKER] Execution error:", err?.message || err);
    throw err;
  }
}

// Execute directly if invoked from command line
if (process.argv[1]?.includes("run-worker")) {
  runLocalWorkerBatch()
    .then(() => {
      console.log("[LOCAL_WORKER] Batch execution completed successfully.");
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}
