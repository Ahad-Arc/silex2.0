import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { db } from "@/db";
import { processOutboxBatchFn } from "@/lib/automation/processor";
import { processWebhookDeliveryBatchFn } from "@/lib/automation/dispatcher";
import { verifyWorkerCronAuthorization } from "@/lib/server-functions/automation";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/**
 * Handles HTTP requests targeting automation worker triggers:
 * `/api/v1/automation/worker` or `/api/v1/cron/worker`
 */
export async function handleWorkerEndpointRequest(request: Request): Promise<Response | null> {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  if (url.pathname !== "/api/v1/automation/worker" && url.pathname !== "/api/v1/cron/worker") {
    return null;
  }

  if (request.method !== "POST" && request.method !== "GET") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const isAuthorized = verifyWorkerCronAuthorization(authHeader);

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({
        error: "UNAUTHORIZED_WORKER_TRIGGER",
        message: "Worker execution requires a valid 'Authorization: Bearer <CRON_SECRET>' header.",
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      }
    );
  }

  try {
    if (!db) {
      throw new Error("DATABASE_ERROR: Database handle is uninitialized.");
    }

    const outboxResult = await processOutboxBatchFn(10, db);
    const webhookResult = await processWebhookDeliveryBatchFn(10, db);

    return new Response(
      JSON.stringify({
        ok: true,
        timestamp: new Date().toISOString(),
        outbox: outboxResult,
        webhooks: webhookResult,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[WORKER_ENDPOINT_ERROR]", err);
    return new Response(
      JSON.stringify({
        error: "WORKER_EXECUTION_ERROR",
        message: err?.message || "Worker execution failed.",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  /**
   * Primary HTTP request handler (supports Nitro / Cloudflare Workers / TanStack Start SSR)
   */
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const workerResponse = await handleWorkerEndpointRequest(request);
      if (workerResponse) {
        return workerResponse;
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },

  /**
   * Native Cloudflare Workers Scheduled Event Handler (Cron Triggers)
   */
  async scheduled(event: { cron?: string; scheduledTime?: number }, env: unknown, ctx: unknown) {
    console.log(`[WORKER_CRON] Cloudflare Cron Trigger executed at ${new Date().toISOString()}`);
    try {
      if (!db) {
        console.error("[WORKER_CRON] Database handle uninitialized.");
        return;
      }
      const outboxResult = await processOutboxBatchFn(10, db);
      const webhookResult = await processWebhookDeliveryBatchFn(10, db);
      console.log(
        `[WORKER_CRON] Batch completed. Outbox: ${outboxResult.processedCount} processed, Webhooks: ${webhookResult.deliveredCount} delivered.`
      );
    } catch (err) {
      console.error("[WORKER_CRON] Scheduled execution error:", err);
    }
  },
};
