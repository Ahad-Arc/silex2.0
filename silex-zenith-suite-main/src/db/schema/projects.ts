import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  bigint,
  numeric,
  uniqueIndex,
  index,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users, uuidv7 } from "./identity";
import { workspaces } from "./workspaces";
import { clients } from "./crm";

// Table 13: projects (client_id OPTIONAL)
export const projects = pgTable(
  "projects",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }), // OPTIONAL
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 50 }),
    description: text("description"),
    status: varchar("status", { length: 50 }).default("planning").notNull(),
    budgetCents: bigint("budget_cents", { mode: "number" }),
    startDate: timestamp("start_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_projects_ws_client").on(table.workspaceId, table.clientId),
    index("idx_projects_ws_status").on(table.workspaceId, table.status),
  ],
);

// Table 14: project_members
export const projectMembers = pgTable(
  "project_members",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    projectRole: varchar("project_role", { length: 50 }).default("contributor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_project_members_unique").on(table.projectId, table.userId)],
);

// Table 15: tasks (with self-referencing parentTaskId FK and due_date performance index)
export const tasks = pgTable(
  "tasks",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    parentTaskId: uuid("parent_task_id"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 50 }).default("todo").notNull(),
    priority: varchar("priority", { length: 20 }).default("medium").notNull(),
    estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.parentTaskId],
      foreignColumns: [table.id],
      name: "tasks_parent_task_id_fkey",
    }).onDelete("cascade"),
    index("idx_tasks_ws_proj").on(table.workspaceId, table.projectId),
    index("idx_tasks_ws_status").on(table.workspaceId, table.status),
    index("idx_tasks_ws_due_date").on(table.workspaceId, table.dueDate),
    index("idx_tasks_parent").on(table.parentTaskId),
  ],
);

// Table 16: task_assignees
export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id")
      .references(() => tasks.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index("idx_task_assignees_user").on(table.workspaceId, table.userId),
  ],
);

// Table 17: task_tags
export const taskTags = pgTable(
  "task_tags",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    colorHex: varchar("color_hex", { length: 7 }).default("#64748B").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_task_tags_unique").on(table.workspaceId, table.name)],
);

// Table 18: task_comments
export const taskComments = pgTable(
  "task_comments",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    taskId: uuid("task_id")
      .references(() => tasks.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("idx_task_comments_task").on(table.workspaceId, table.taskId)],
);
