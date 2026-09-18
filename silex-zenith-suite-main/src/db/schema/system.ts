import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users, uuidv7 } from "./identity";
import { workspaces } from "./workspaces";

// Table 40: api_keys
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 10 }).notNull(),
    keyHash: varchar("key_hash", { length: 255 }).notNull(),
    scopes: jsonb("scopes").$type<string[]>().default(["*"]).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_api_keys_hash").on(table.keyHash),
    index("idx_api_keys_ws").on(table.workspaceId),
  ],
);

// Table 41: idempotency_keys
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    requestPath: text("request_path").notNull(),
    responseCode: integer("response_code"),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
    status: varchar("status", { length: 20 }).default("processing").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_idempotency_unique").on(table.workspaceId, table.key),
    index("idx_idempotency_expires").on(table.expiresAt),
  ],
);
