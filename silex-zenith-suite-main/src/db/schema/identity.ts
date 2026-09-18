import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Helper for RFC 9562 UUIDv7
export const uuidv7 = () =>
  uuid("id")
    .default(sql`gen_uuidv7()`)
    .primaryKey();

// Table 1: users
export const users = pgTable(
  "users",
  {
    id: uuidv7(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    avatarUrl: text("avatar_url"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_users_email_active")
      .on(table.email)
      .where(sql`deleted_at IS NULL`),
    index("idx_users_active").on(table.isActive),
  ],
);

// Table 2: accounts (OAuth)
export const accounts = pgTable(
  "accounts",
  {
    id: uuidv7(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_accounts_provider_account").on(table.provider, table.providerAccountId),
    index("idx_accounts_user_id").on(table.userId),
  ],
);

// Table 3: sessions
export const sessions = pgTable(
  "sessions",
  {
    id: uuidv7(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    activeWorkspaceId: uuid("active_workspace_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_sessions_token_hash").on(table.tokenHash),
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_expires_at").on(table.expiresAt),
  ],
);

// Table 4: user_preferences
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuidv7(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    theme: varchar("theme", { length: 20 }).default("dark").notNull(),
    timezone: varchar("timezone", { length: 100 }).default("UTC").notNull(),
    locale: varchar("locale", { length: 10 }).default("en-US").notNull(),
    keyboardShortcutsEnabled: boolean("keyboard_shortcuts_enabled").default(true).notNull(),
    uiConfig: jsonb("ui_config").$type<Record<string, unknown>>().default({}).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_user_preferences_user_id").on(table.userId)],
);
