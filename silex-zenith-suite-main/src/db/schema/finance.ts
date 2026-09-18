import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  bigint,
  integer,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users, uuidv7 } from "./identity";
import { workspaces } from "./workspaces";
import { clients } from "./crm";
import { projects } from "./projects";

// Table 19: invoices (with due_date performance index)
export const invoices = pgTable(
  "invoices",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "restrict" })
      .notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).default("draft").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).default(0).notNull(),
    taxCents: bigint("tax_cents", { mode: "number" }).default(0).notNull(),
    discountCents: bigint("discount_cents", { mode: "number" }).default(0).notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).default(0).notNull(),
    amountPaidCents: bigint("amount_paid_cents", { mode: "number" }).default(0).notNull(),
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    notes: text("notes"),
    terms: text("terms"),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_invoices_number_unique")
      .on(table.workspaceId, table.invoiceNumber)
      .where(sql`deleted_at IS NULL`),
    index("idx_invoices_ws_status").on(table.workspaceId, table.status),
    index("idx_invoices_ws_due_date").on(table.workspaceId, table.dueDate),
    index("idx_invoices_client").on(table.workspaceId, table.clientId),
  ],
);

// Table 20: invoice_items
export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    invoiceId: uuid("invoice_id")
      .references(() => invoices.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).default("1.0000").notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_invoice_items_invoice").on(table.workspaceId, table.invoiceId)],
);

// Table 21: payments (with partial unique index on workspace_id + transaction_reference)
export const payments = pgTable(
  "payments",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    invoiceId: uuid("invoice_id")
      .references(() => invoices.id, { onDelete: "restrict" })
      .notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
    transactionReference: varchar("transaction_reference", { length: 255 }),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_payments_ws_trans_ref")
      .on(table.workspaceId, table.transactionReference)
      .where(sql`transaction_reference IS NOT NULL`),
    index("idx_payments_invoice").on(table.workspaceId, table.invoiceId),
  ],
);

// Table 22: expenses
export const expenses = pgTable(
  "expenses",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    expenseDate: timestamp("expense_date", { withTimezone: true }).notNull(),
    vendorName: varchar("vendor_name", { length: 255 }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    receiptUrl: text("receipt_url"),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("idx_expenses_ws_cat").on(table.workspaceId, table.category)],
);

// Table 23: subscriptions
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_subscriptions_workspace").on(table.workspaceId),
    uniqueIndex("idx_subscriptions_stripe").on(table.stripeSubscriptionId),
  ],
);
