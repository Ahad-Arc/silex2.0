import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users, uuidv7 } from "./identity";
import { workspaces } from "./workspaces";
import { events, outboxEvents } from "./analytics";

// Table 36: automation_rules
export const automationRules = pgTable(
  "automation_rules",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    triggerEvent: varchar("trigger_event", { length: 100 }).notNull(),
    conditions: jsonb("conditions").$type<Array<Record<string, unknown>>>().default([]).notNull(),
    actions: jsonb("actions").$type<Array<Record<string, unknown>>>().default([]).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_automation_rules_ws").on(table.workspaceId, table.triggerEvent)],
);

// Table 37: automation_runs
export const automationRuns = pgTable(
  "automation_runs",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    ruleId: uuid("rule_id")
      .references(() => automationRules.id, { onDelete: "cascade" })
      .notNull(),
    outboxEventId: uuid("outbox_event_id").references(() => outboxEvents.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 20 }).notNull(),
    logs: jsonb("logs").$type<Array<Record<string, unknown>>>().default([]).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_automation_runs_rule").on(table.workspaceId, table.ruleId),
    index("idx_automation_runs_outbox_event_id").on(
      table.workspaceId,
      table.outboxEventId
    ),
  ],
);

// Table 38: webhooks
export const webhooks = pgTable(
  "webhooks",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    targetUrl: text("target_url").notNull(),
    secret: varchar("secret", { length: 255 }).notNull(),
    subscribedEvents: jsonb("subscribed_events").$type<string[]>().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_webhooks_ws").on(table.workspaceId, table.isActive)],
);

// Table 39: webhook_deliveries
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    webhookId: uuid("webhook_id")
      .references(() => webhooks.id, { onDelete: "cascade" })
      .notNull(),
    eventId: uuid("event_id")
      .references(() => outboxEvents.id, { onDelete: "cascade" })
      .notNull(),
    responseStatusCode: integer("response_status_code"),
    responseBody: text("response_body"),
    executionDurationMs: integer("execution_duration_ms"),
    status: varchar("status", { length: 20 }).notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    retryCount: integer("retry_count").default(0).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_webhook_deliveries_hook").on(table.workspaceId, table.webhookId),
    index("idx_webhook_deliveries_queue").on(table.status, table.nextRetryAt),
    index("idx_webhook_deliveries_stale")
      .on(table.status, table.claimedAt)
      .where(sql`status = 'processing'`),
  ],
);
