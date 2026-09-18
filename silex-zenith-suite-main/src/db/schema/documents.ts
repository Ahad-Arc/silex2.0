import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  bigint,
  jsonb,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users, uuidv7 } from "./identity";
import { workspaces } from "./workspaces";

// Table 24: folders (with self-referencing parentFolderId FK)
export const folders = pgTable(
  "folders",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    parentFolderId: uuid("parent_folder_id"),
    name: varchar("name", { length: 255 }).notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.parentFolderId],
      foreignColumns: [table.id],
      name: "folders_parent_folder_id_fkey",
    }).onDelete("cascade"),
    uniqueIndex("idx_folders_parent_name")
      .on(table.workspaceId, table.parentFolderId, table.name)
      .where(sql`deleted_at IS NULL`),
    index("idx_folders_ws_parent").on(table.workspaceId, table.parentFolderId),
  ],
);

// Table 25: documents
export const documents = pgTable(
  "documents",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    contentJson: jsonb("content_json").$type<Record<string, unknown>>().default({}).notNull(),
    isTemplate: boolean("is_template").default(false).notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("idx_documents_ws_folder").on(table.workspaceId, table.folderId)],
);

// Table 26: attachments
export const attachments = pgTable(
  "attachments",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    storagePath: text("storage_path").notNull(),
    attachedToType: varchar("attached_to_type", { length: 50 }),
    attachedToId: uuid("attached_to_id"),
    uploadedBy: uuid("uploaded_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_attachments_lookup").on(table.workspaceId, table.attachedToType, table.attachedToId),
  ],
);
