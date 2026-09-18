import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users, uuidv7 } from "./identity";
import { workspaces } from "./workspaces";

// Table 33: events (Domain Event Stream)
export const events = pgTable(
  "events",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_events_ws_type").on(table.workspaceId, table.eventType, table.createdAt)],
);

// Table 34: audit_logs (Security & Compliance Audit Trail)
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    oldValues: jsonb("old_values").$type<Record<string, unknown>>(),
    newValues: jsonb("new_values").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_logs_ws_entity").on(table.workspaceId, table.entityType, table.entityId),
    index("idx_audit_logs_actor").on(table.workspaceId, table.actorId),
  ],
);

// Table 35: outbox_events (Transactional Outbox Pattern with explicit workspace FK)
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    aggregateType: varchar("aggregate_type", { length: 50 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_outbox_pending")
      .on(table.status, table.createdAt)
      .where(sql`status = 'pending'`),
    index("idx_outbox_events_stale_claim")
      .on(table.status, table.claimedAt)
      .where(sql`status = 'processing'`),
  ],
);
