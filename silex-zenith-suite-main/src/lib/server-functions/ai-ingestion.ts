/**
 * SILEX AI Zenith — Server-Side Vector Ingestion Service
 * 
 * Provides authorized workspace-isolated RAG memory indexing for documents,
 * tasks, and client notes using the AI provider embedding abstraction.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { db } from "@/db";
import { documents, tasks, clientNotes, clients, aiMemory } from "@/db/schema";
import {
  getAIProvider,
  chunkText,
  extractDocumentText,
  extractTaskText,
  extractClientNoteText,
  computeContentHash,
} from "@/lib/ai";

if (typeof window !== "undefined") {
  throw new Error(
    "CRITICAL SECURITY ERROR: AI ingestion server functions must NEVER be imported or executed in client browser environments."
  );
}

// Validation Schemas
export const indexDocumentInputSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  workspaceId: z.string().optional(),
});

export const indexTaskInputSchema = z.object({
  taskId: z.string().min(1, "Task ID is required"),
  workspaceId: z.string().optional(),
});

export const indexClientNoteInputSchema = z.object({
  noteId: z.string().min(1, "Note ID is required"),
  workspaceId: z.string().optional(),
});

export const reindexWorkspaceInputSchema = z.object({
  workspaceId: z.string().optional(),
  batchSize: z.number().int().positive().max(100).default(50).optional(),
});

/**
 * Server Function: indexDocumentFn
 * Ingests a single document into workspace ai_memory with deduplication.
 */
export const indexDocumentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => indexDocumentInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const docRows = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, data.documentId),
          eq(documents.workspaceId, auth.workspaceId),
          isNull(documents.deletedAt)
        )
      )
      .limit(1);

    if (docRows.length === 0) {
      throw new Error("Document not found or access denied.");
    }

    const doc = docRows[0];
    const rawText = extractDocumentText(doc.title, doc.contentJson);
    const contentHash = computeContentHash(rawText);

    // Deduplication check: compare existing ai_memory hash
    const existingMemory = await db
      .select({ metadata: aiMemory.metadata })
      .from(aiMemory)
      .where(
        and(
          eq(aiMemory.workspaceId, auth.workspaceId),
          eq(aiMemory.entityType, "document"),
          eq(aiMemory.entityId, doc.id)
        )
      );

    if (
      existingMemory.length > 0 &&
      existingMemory.every((row) => row.metadata?.contentHash === contentHash)
    ) {
      return {
        status: "skipped",
        reason: "unchanged",
        entityType: "document",
        entityId: doc.id,
        chunkCount: existingMemory.length,
      };
    }

    // Chunk document text
    const chunks = chunkText({
      workspaceId: auth.workspaceId,
      entityType: "document",
      entityId: doc.id,
      sourceTitle: doc.title,
      rawText,
    });

    const provider = getAIProvider();

    // Perform database replace in transaction
    return await db.transaction(async (tx) => {
      await tx
        .delete(aiMemory)
        .where(
          and(
            eq(aiMemory.workspaceId, auth.workspaceId),
            eq(aiMemory.entityType, "document"),
            eq(aiMemory.entityId, doc.id)
          )
        );

      if (chunks.length === 0) {
        return {
          status: "cleared",
          entityType: "document",
          entityId: doc.id,
          chunkCount: 0,
        };
      }

      for (const chunk of chunks) {
        const { embedding, dimensions } = await provider.createEmbedding(chunk.chunkContent);

        if (!embedding || embedding.length !== 1536 || dimensions !== 1536) {
          throw new Error(
            `CRITICAL EMBEDDING ERROR: Provider returned invalid embedding dimensions (${dimensions}). Expected 1536.`
          );
        }

        await tx.insert(aiMemory).values({
          workspaceId: auth.workspaceId,
          entityType: "document",
          entityId: doc.id,
          chunkContent: chunk.chunkContent,
          embedding,
          metadata: chunk.metadata,
        });
      }

      return {
        status: "indexed",
        entityType: "document",
        entityId: doc.id,
        chunkCount: chunks.length,
      };
    });
  });

/**
 * Server Function: indexTaskFn
 * Ingests a single task into workspace ai_memory with deduplication.
 */
export const indexTaskFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => indexTaskInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const taskRows = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.id, data.taskId),
          eq(tasks.workspaceId, auth.workspaceId),
          isNull(tasks.deletedAt)
        )
      )
      .limit(1);

    if (taskRows.length === 0) {
      throw new Error("Task not found or access denied.");
    }

    const task = taskRows[0];
    const rawText = extractTaskText({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    });
    const contentHash = computeContentHash(rawText);

    const existingMemory = await db
      .select({ metadata: aiMemory.metadata })
      .from(aiMemory)
      .where(
        and(
          eq(aiMemory.workspaceId, auth.workspaceId),
          eq(aiMemory.entityType, "task"),
          eq(aiMemory.entityId, task.id)
        )
      );

    if (
      existingMemory.length > 0 &&
      existingMemory.every((row) => row.metadata?.contentHash === contentHash)
    ) {
      return {
        status: "skipped",
        reason: "unchanged",
        entityType: "task",
        entityId: task.id,
        chunkCount: existingMemory.length,
      };
    }

    const chunks = chunkText({
      workspaceId: auth.workspaceId,
      entityType: "task",
      entityId: task.id,
      sourceTitle: task.title,
      rawText,
    });

    const provider = getAIProvider();

    return await db.transaction(async (tx) => {
      await tx
        .delete(aiMemory)
        .where(
          and(
            eq(aiMemory.workspaceId, auth.workspaceId),
            eq(aiMemory.entityType, "task"),
            eq(aiMemory.entityId, task.id)
          )
        );

      if (chunks.length === 0) {
        return {
          status: "cleared",
          entityType: "task",
          entityId: task.id,
          chunkCount: 0,
        };
      }

      for (const chunk of chunks) {
        const { embedding, dimensions } = await provider.createEmbedding(chunk.chunkContent);

        if (!embedding || embedding.length !== 1536 || dimensions !== 1536) {
          throw new Error(
            `CRITICAL EMBEDDING ERROR: Provider returned invalid embedding dimensions (${dimensions}). Expected 1536.`
          );
        }

        await tx.insert(aiMemory).values({
          workspaceId: auth.workspaceId,
          entityType: "task",
          entityId: task.id,
          chunkContent: chunk.chunkContent,
          embedding,
          metadata: chunk.metadata,
        });
      }

      return {
        status: "indexed",
        entityType: "task",
        entityId: task.id,
        chunkCount: chunks.length,
      };
    });
  });

/**
 * Server Function: indexClientNoteFn
 * Ingests a single client note into workspace ai_memory with deduplication.
 */
export const indexClientNoteFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => indexClientNoteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const noteRows = await db
      .select({
        note: clientNotes,
        clientCompany: clients.companyName,
      })
      .from(clientNotes)
      .leftJoin(clients, eq(clientNotes.clientId, clients.id))
      .where(
        and(
          eq(clientNotes.id, data.noteId),
          eq(clientNotes.workspaceId, auth.workspaceId),
          isNull(clientNotes.deletedAt)
        )
      )
      .limit(1);

    if (noteRows.length === 0) {
      throw new Error("Client note not found or access denied.");
    }

    const { note, clientCompany } = noteRows[0];
    const rawText = extractClientNoteText({
      content: note.content,
      isPinned: note.isPinned,
      clientCompanyName: clientCompany || undefined,
    });
    const contentHash = computeContentHash(rawText);

    const existingMemory = await db
      .select({ metadata: aiMemory.metadata })
      .from(aiMemory)
      .where(
        and(
          eq(aiMemory.workspaceId, auth.workspaceId),
          eq(aiMemory.entityType, "client_note"),
          eq(aiMemory.entityId, note.id)
        )
      );

    if (
      existingMemory.length > 0 &&
      existingMemory.every((row) => row.metadata?.contentHash === contentHash)
    ) {
      return {
        status: "skipped",
        reason: "unchanged",
        entityType: "client_note",
        entityId: note.id,
        chunkCount: existingMemory.length,
      };
    }

    const chunks = chunkText({
      workspaceId: auth.workspaceId,
      entityType: "client_note",
      entityId: note.id,
      sourceTitle: clientCompany ? `Note for ${clientCompany}` : "Client Note",
      rawText,
    });

    const provider = getAIProvider();

    return await db.transaction(async (tx) => {
      await tx
        .delete(aiMemory)
        .where(
          and(
            eq(aiMemory.workspaceId, auth.workspaceId),
            eq(aiMemory.entityType, "client_note"),
            eq(aiMemory.entityId, note.id)
          )
        );

      if (chunks.length === 0) {
        return {
          status: "cleared",
          entityType: "client_note",
          entityId: note.id,
          chunkCount: 0,
        };
      }

      for (const chunk of chunks) {
        const { embedding, dimensions } = await provider.createEmbedding(chunk.chunkContent);

        if (!embedding || embedding.length !== 1536 || dimensions !== 1536) {
          throw new Error(
            `CRITICAL EMBEDDING ERROR: Provider returned invalid embedding dimensions (${dimensions}). Expected 1536.`
          );
        }

        await tx.insert(aiMemory).values({
          workspaceId: auth.workspaceId,
          entityType: "client_note",
          entityId: note.id,
          chunkContent: chunk.chunkContent,
          embedding,
          metadata: chunk.metadata,
        });
      }

      return {
        status: "indexed",
        entityType: "client_note",
        entityId: note.id,
        chunkCount: chunks.length,
      };
    });
  });

/**
 * Server Function: reindexWorkspaceMemoryFn
 * Reindexes all documents, tasks, and client notes in an authorized workspace with batching.
 */
export const reindexWorkspaceMemoryFn = createServerFn({ method: "POST" })
  .validator((data?: unknown) => reindexWorkspaceInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // 1. Fetch workspace documents
    const docList = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.workspaceId, auth.workspaceId), isNull(documents.deletedAt)));

    // 2. Fetch workspace tasks
    const taskList = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.workspaceId, auth.workspaceId), isNull(tasks.deletedAt)));

    // 3. Fetch workspace client notes
    const noteList = await db
      .select({ id: clientNotes.id })
      .from(clientNotes)
      .where(and(eq(clientNotes.workspaceId, auth.workspaceId), isNull(clientNotes.deletedAt)));

    let indexedCount = 0;
    let skippedCount = 0;
    let totalChunks = 0;

    // Process documents sequentially
    for (const doc of docList) {
      const res = await indexDocumentFn({
        data: { documentId: doc.id, workspaceId: auth.workspaceId },
      });
      if (res.status === "skipped") {
        skippedCount++;
      } else {
        indexedCount++;
        totalChunks += res.chunkCount;
      }
    }

    // Process tasks sequentially
    for (const task of taskList) {
      const res = await indexTaskFn({
        data: { taskId: task.id, workspaceId: auth.workspaceId },
      });
      if (res.status === "skipped") {
        skippedCount++;
      } else {
        indexedCount++;
        totalChunks += res.chunkCount;
      }
    }

    // Process client notes sequentially
    for (const note of noteList) {
      const res = await indexClientNoteFn({
        data: { noteId: note.id, workspaceId: auth.workspaceId },
      });
      if (res.status === "skipped") {
        skippedCount++;
      } else {
        indexedCount++;
        totalChunks += res.chunkCount;
      }
    }

    return {
      workspaceId: auth.workspaceId,
      documentsCount: docList.length,
      tasksCount: taskList.length,
      clientNotesCount: noteList.length,
      totalEntitiesProcessed: docList.length + taskList.length + noteList.length,
      indexedEntitiesCount: indexedCount,
      skippedEntitiesCount: skippedCount,
      totalChunksIndexed: totalChunks,
    };
  });
