import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { users, uuidv7 } from "./identity";
import { workspaces } from "./workspaces";

// Custom pgvector type for Drizzle ORM
export const pgVector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "extensions.vector(1536)";
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

// Table 27: ai_conversations
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 255 }).default("New Conversation").notNull(),
    modelName: varchar("model_name", { length: 100 }).default("gemini-2.5-flash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("idx_ai_conversations_user").on(table.workspaceId, table.userId)],
);

// Table 28: ai_messages
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id")
      .references(() => aiConversations.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    tokensUsed: integer("tokens_used"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_ai_messages_conv").on(table.workspaceId, table.conversationId)],
);

// Table 29: ai_memory (pgvector RAG store)
export const aiMemory = pgTable(
  "ai_memory",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    chunkContent: text("chunk_content").notNull(),
    embedding: pgVector("embedding").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_ai_memory_ws_entity").on(table.workspaceId, table.entityType, table.entityId),
  ],
);

// Table 30: ai_tool_calls
export const aiToolCalls = pgTable(
  "ai_tool_calls",
  {
    id: uuidv7(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    messageId: uuid("message_id")
      .references(() => aiMessages.id, { onDelete: "cascade" })
      .notNull(),
    toolName: varchar("tool_name", { length: 100 }).notNull(),
    arguments: jsonb("arguments").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }),
  },
  (table) => [index("idx_ai_tool_calls_msg").on(table.workspaceId, table.messageId)],
);
