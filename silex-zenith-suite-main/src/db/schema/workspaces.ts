import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  smallint,
  integer,
  bigint,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users, uuidv7 } from "./identity";

// Table 5: workspaces
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuidv7(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    logoUrl: text("logo_url"),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    planTier: varchar("plan_tier", { length: 50 }).default("free").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_workspaces_slug_active")
      .on(table.slug)
      .where(sql`deleted_at IS NULL`),
    index("idx_workspaces_owner").on(table.ownerId),
  ],
);

// Table 6: workspace_roles (Custom RBAC)
export const workspaceRoles = pgTable(
  "workspace_roles",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_ws_roles_name").on(table.workspaceId, table.name)],
);

// Table 7: workspace_members
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 50 }).default("member").notNull(),
    customRoleId: uuid("custom_role_id").references(() => workspaceRoles.id, {
      onDelete: "set null",
    }),
    jobTitle: varchar("job_title", { length: 100 }),
    hourlyRateCents: bigint("hourly_rate_cents", { mode: "number" }),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_ws_members_unique").on(table.workspaceId, table.userId),
    index("idx_ws_members_lookup").on(table.workspaceId, table.userId),
    index("idx_ws_members_user").on(table.userId),
  ],
);

// Table 8: workspace_settings
export const workspaceSettings = pgTable(
  "workspace_settings",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    defaultCurrency: varchar("default_currency", { length: 3 }).default("USD").notNull(),
    fiscalYearStartMonth: smallint("fiscal_year_start_month").default(1).notNull(),
    invoicePrefix: varchar("invoice_prefix", { length: 20 }).default("INV-").notNull(),
    invoiceNextNumber: integer("invoice_next_number").default(1001).notNull(),
    taxId: varchar("tax_id", { length: 100 }),
    brandingColors: jsonb("branding_colors")
      .$type<{ primary: string; secondary?: string; accent?: string }>()
      .default({ primary: "#0F172A" })
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_ws_settings_workspace_id").on(table.workspaceId)],
);

// Table 9: workspace_invitations
export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).default("member").notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    invitedByUserId: uuid("invited_by_user_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_ws_invites_token_hash").on(table.tokenHash),
    index("idx_ws_invites_lookup").on(table.workspaceId, table.email),
  ],
);
