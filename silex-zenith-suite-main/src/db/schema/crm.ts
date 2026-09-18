import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users, uuidv7 } from "./identity";
import { workspaces } from "./workspaces";

// Interfaces for CRM Data
export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// Table 10: clients
export const clients = pgTable(
  "clients",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    website: text("website"),
    status: varchar("status", { length: 50 }).default("lead").notNull(),
    billingAddress: jsonb("billing_address").$type<Address>().default({}).notNull(),
    shippingAddress: jsonb("shipping_address").$type<Address>().default({}).notNull(),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_clients_ws_status").on(table.workspaceId, table.status),
    index("idx_clients_deleted")
      .on(table.workspaceId, table.id)
      .where(sql`deleted_at IS NULL`),
  ],
);

// Table 11: client_contacts
export const clientContacts = pgTable(
  "client_contacts",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "cascade" })
      .notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    jobTitle: varchar("job_title", { length: 100 }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("idx_contacts_client").on(table.workspaceId, table.clientId)],
);

// Table 12: client_notes
export const clientNotes = pgTable(
  "client_notes",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    content: text("content").notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("idx_notes_client").on(table.workspaceId, table.clientId)],
);
