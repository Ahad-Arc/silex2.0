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
import { users, uuidv7 } from "./identity";
import { workspaces } from "./workspaces";

// Table 31: notifications
export const notifications = pgTable(
  "notifications",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    recipientUserId: uuid("recipient_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    actionUrl: text("action_url"),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_notifs_user_unread")
      .on(table.recipientUserId, table.isRead)
      .where(sql`is_read IS FALSE`),
    index("idx_notifs_ws_user").on(table.workspaceId, table.recipientUserId),
  ],
);

// Table 32: notification_preferences
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuidv7(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    emailNotifications: boolean("email_notifications").default(true).notNull(),
    pushNotifications: boolean("push_notifications").default(true).notNull(),
    slackNotifications: boolean("slack_notifications").default(false).notNull(),
    eventTypes: jsonb("event_types")
      .$type<Record<string, boolean>>()
      .default({ task_assigned: true, invoice_paid: true })
      .notNull(),
  },
  (table) => [uniqueIndex("idx_notif_prefs_user").on(table.userId)],
);
