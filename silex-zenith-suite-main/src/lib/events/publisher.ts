import { z } from "zod";
import { db as globalDb } from "@/db";
import { events, outboxEvents } from "@/db/schema";
import {
  domainEventTypeSchema,
  type PublishDomainEventParams,
  type DomainEventRecord,
  type OutboxEventRecord,
} from "./types";

/**
 * Sensitive Keys Blacklist
 * Payload fields matching these keys are automatically stripped before event persistence.
 */
const SENSITIVE_KEY_PATTERNS = [
  "password",
  "passwordhash",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "keyhash",
  "apikey",
  "creditcard",
  "ssn",
];

/**
 * Sanitizes event payloads to ensure no sensitive credentials or tokens are stored in events/outbox.
 */
export function sanitizeEventPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEY_PATTERNS.some((pattern) => lowerKey.includes(pattern))) {
      continue; // Omit sensitive field
    }

    if (value !== undefined && typeof value !== "function") {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Publish Domain Event & Transactional Outbox Record
 * 
 * Atomically writes both the domain event log (`events`) and outbox event queue (`outbox_events`).
 * Accepts either a Drizzle transaction handle `tx` or defaults to global `db`.
 */
export async function publishDomainEvent(
  params: PublishDomainEventParams,
  executor?: any
): Promise<{ domainEvent: DomainEventRecord; outboxEvent: OutboxEventRecord }> {
  // Validate workspace identity
  if (!params.workspaceId || params.workspaceId.trim() === "") {
    throw new Error("INVALID_WORKSPACE_ID: Event workspace identity must be non-empty.");
  }

  // Validate aggregate identity
  if (!params.aggregateId || params.aggregateId.trim() === "") {
    throw new Error("INVALID_AGGREGATE_ID: Event aggregate identity must be non-empty.");
  }

  // Validate event type
  const eventType = domainEventTypeSchema.parse(params.eventType);

  // Sanitize payload
  const sanitizedPayload = sanitizeEventPayload(params.payload || {});

  const client = executor || globalDb;
  if (!client) {
    throw new Error("DATABASE_CLIENT_UNINITIALIZED: Cannot publish event without active database handle.");
  }

  // Insert into events (Domain Event Log)
  const [domainEventRow] = await client
    .insert(events)
    .values({
      workspaceId: params.workspaceId,
      eventType,
      actorId: params.actorId || null,
      payload: sanitizedPayload,
    })
    .returning();

  // Insert into outbox_events (Transactional Outbox Queue)
  const [outboxEventRow] = await client
    .insert(outboxEvents)
    .values({
      workspaceId: params.workspaceId,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      eventType,
      actorId: params.actorId || null,
      payload: sanitizedPayload,
      status: "pending",
      retryCount: 0,
      errorMessage: null,
    })
    .returning();

  return {
    domainEvent: domainEventRow as DomainEventRecord,
    outboxEvent: outboxEventRow as OutboxEventRecord,
  };
}
