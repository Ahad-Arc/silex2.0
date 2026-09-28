/**
 * SILEX Documents & Storage — Server Functions Backend Foundation
 *
 * Implements workspace-isolated CRUD and security boundaries for
 * folders, documents, and file attachments with automatic AI Zenith RAG indexing
 * and domain event publishing.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, isNull, desc, ilike } from "drizzle-orm";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { db } from "@/db";
import {
  folders,
  documents,
  attachments,
  tasks,
  clients,
  invoices,
  aiMemory,
} from "@/db/schema";
import { indexDocumentFn } from "@/lib/server-functions/ai-ingestion";
import {
  validateAttachmentFile,
  sanitizeFileName,
  generateStoragePath,
  verifyStoragePathTenantOwnership,
  getStorageStatusInfo,
  requestSignedDownloadUrl,
  deleteStorageObject,
  MAX_UPLOAD_LIMIT_BYTES,
} from "@/lib/storage";

// Input Validation Schemas
export const getFoldersInputSchema = z.object({
  workspaceId: z.string().optional(),
});

export const createFolderInputSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(255),
  parentFolderId: z.string().uuid().nullable().optional(),
  workspaceId: z.string().optional(),
});

export const deleteFolderInputSchema = z.object({
  folderId: z.string().uuid("Invalid folder ID"),
  workspaceId: z.string().optional(),
});

export const getDocumentsInputSchema = z.object({
  workspaceId: z.string().optional(),
  folderId: z.string().uuid().nullable().optional(),
  search: z.string().optional(),
  isTemplate: z.boolean().optional(),
});

export const getDocumentByIdInputSchema = z.object({
  documentId: z.string().uuid("Invalid document ID"),
  workspaceId: z.string().optional(),
});

export const createDocumentInputSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  contentJson: z.record(z.any()).optional().default({}),
  folderId: z.string().uuid().nullable().optional(),
  isTemplate: z.boolean().optional().default(false),
  workspaceId: z.string().optional(),
});

export const updateDocumentInputSchema = z.object({
  documentId: z.string().uuid("Invalid document ID"),
  title: z.string().min(1, "Title is required").max(255).optional(),
  contentJson: z.record(z.any()).optional(),
  folderId: z.string().uuid().nullable().optional(),
  isTemplate: z.boolean().optional(),
  workspaceId: z.string().optional(),
});

export const deleteDocumentInputSchema = z.object({
  documentId: z.string().uuid("Invalid document ID"),
  workspaceId: z.string().optional(),
});

export const uploadAttachmentInputSchema = z.object({
  fileName: z.string().min(1, "File name is required").max(255),
  fileSizeBytes: z
    .number()
    .int()
    .positive("File size must be positive")
    .max(MAX_UPLOAD_LIMIT_BYTES, "File size exceeds 50MB limit"),
  mimeType: z.string().min(1, "MIME type is required").max(100),
  storagePath: z.string().min(1, "Storage path cannot be empty").optional(),
  attachedToType: z.enum(["document", "task", "client", "invoice"]).optional(),
  attachedToId: z.string().uuid().optional(),
  workspaceId: z.string().optional(),
});

export const deleteAttachmentInputSchema = z.object({
  attachmentId: z.string().uuid("Invalid attachment ID"),
  workspaceId: z.string().optional(),
});

export const getAttachmentDownloadUrlInputSchema = z.object({
  attachmentId: z.string().uuid("Invalid attachment ID"),
  workspaceId: z.string().optional(),
});

export const getStorageConfigInputSchema = z.object({
  workspaceId: z.string().optional(),
});

/**
 * Server Function: getFoldersFn
 * Retrieves all active folders for the authorized workspace.
 */
export const getFoldersFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getFoldersInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const folderRows = await db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.workspaceId, auth.workspaceId),
          isNull(folders.deletedAt)
        )
      )
      .orderBy(folders.name);

    return folderRows.map((f) => ({
      id: f.id,
      workspaceId: f.workspaceId,
      parentFolderId: f.parentFolderId,
      name: f.name,
      createdBy: f.createdBy,
      createdAt: f.createdAt.toISOString(),
    }));
  });

/**
 * Server Function: createFolderFn
 * Creates a new folder under the authorized workspace with parent folder ownership verification.
 */
export const createFolderFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createFolderInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    if (data.parentFolderId) {
      const parentRows = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.id, data.parentFolderId),
            eq(folders.workspaceId, auth.workspaceId),
            isNull(folders.deletedAt)
          )
        )
        .limit(1);

      if (parentRows.length === 0) {
        throw new Error("PARENT_FOLDER_NOT_FOUND: Parent folder not found or access denied.");
      }
    }

    const [newFolder] = await db
      .insert(folders)
      .values({
        workspaceId: auth.workspaceId,
        parentFolderId: data.parentFolderId || null,
        name: data.name.trim(),
        createdBy: auth.userId,
      })
      .returning();

    return {
      folder: {
        id: newFolder.id,
        workspaceId: newFolder.workspaceId,
        parentFolderId: newFolder.parentFolderId,
        name: newFolder.name,
        createdBy: newFolder.createdBy,
        createdAt: newFolder.createdAt.toISOString(),
      },
    };
  });

/**
 * Server Function: deleteFolderFn
 * Soft deletes a folder under the authorized workspace.
 */
export const deleteFolderFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteFolderInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const folderRows = await db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.id, data.folderId),
          eq(folders.workspaceId, auth.workspaceId),
          isNull(folders.deletedAt)
        )
      )
      .limit(1);

    if (folderRows.length === 0) {
      throw new Error("FOLDER_NOT_FOUND: Folder not found or access denied.");
    }

    const now = new Date();
    await db
      .update(folders)
      .set({ deletedAt: now })
      .where(
        and(
          eq(folders.id, data.folderId),
          eq(folders.workspaceId, auth.workspaceId)
        )
      );

    return { success: true, folderId: data.folderId };
  });

/**
 * Server Function: getDocumentsFn
 * Retrieves documents for the authorized workspace with optional folder and search filtering.
 */
export const getDocumentsFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getDocumentsInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const conditions = [
      eq(documents.workspaceId, auth.workspaceId),
      isNull(documents.deletedAt),
    ];

    if (data?.folderId !== undefined) {
      if (data.folderId === null) {
        conditions.push(isNull(documents.folderId));
      } else {
        conditions.push(eq(documents.folderId, data.folderId));
      }
    }

    if (data?.search && data.search.trim() !== "") {
      conditions.push(ilike(documents.title, `%${data.search.trim()}%`));
    }

    if (data?.isTemplate !== undefined) {
      conditions.push(eq(documents.isTemplate, data.isTemplate));
    }

    const docRows = await db
      .select({
        id: documents.id,
        workspaceId: documents.workspaceId,
        folderId: documents.folderId,
        title: documents.title,
        contentJson: documents.contentJson,
        isTemplate: documents.isTemplate,
        createdBy: documents.createdBy,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt));

    return docRows.map((doc) => ({
      id: doc.id,
      workspaceId: doc.workspaceId,
      folderId: doc.folderId,
      title: doc.title,
      contentJson: (doc.contentJson || {}) as Record<string, any>,
      isTemplate: doc.isTemplate,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    }));
  });

/**
 * Server Function: getDocumentByIdFn
 * Retrieves a single document with its associated attachments for the authorized workspace.
 */
export const getDocumentByIdFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getDocumentByIdInputSchema.parse(data))
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
      return null;
    }

    const doc = docRows[0];

    const attachmentRows = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.workspaceId, auth.workspaceId),
          eq(attachments.attachedToType, "document"),
          eq(attachments.attachedToId, doc.id),
          isNull(attachments.deletedAt)
        )
      )
      .orderBy(desc(attachments.createdAt));

    return {
      document: {
        id: doc.id,
        workspaceId: doc.workspaceId,
        folderId: doc.folderId,
        title: doc.title,
        contentJson: (doc.contentJson || {}) as Record<string, any>,
        isTemplate: doc.isTemplate,
        createdBy: doc.createdBy,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      },
      attachments: attachmentRows.map((att) => ({
        id: att.id,
        workspaceId: att.workspaceId,
        fileName: att.fileName,
        fileSizeBytes: att.fileSizeBytes,
        mimeType: att.mimeType,
        storagePath: att.storagePath,
        attachedToType: att.attachedToType,
        attachedToId: att.attachedToId,
        uploadedBy: att.uploadedBy,
        createdAt: att.createdAt.toISOString(),
      })),
    };
  });

/**
 * Server Function: createDocumentFn
 * Creates a document, publishes document.created event, and triggers automatic RAG vector indexing.
 */
export const createDocumentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createDocumentInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    if (data.folderId) {
      const folderRows = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.id, data.folderId),
            eq(folders.workspaceId, auth.workspaceId),
            isNull(folders.deletedAt)
          )
        )
        .limit(1);

      if (folderRows.length === 0) {
        throw new Error("FOLDER_NOT_FOUND: Target folder not found or access denied.");
      }
    }

    const { publishDomainEvent } = await import("@/lib/events");

    const newDoc = await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(documents)
        .values({
          workspaceId: auth.workspaceId,
          folderId: data.folderId || null,
          title: data.title.trim(),
          contentJson: data.contentJson || {},
          isTemplate: data.isTemplate ?? false,
          createdBy: auth.userId,
        })
        .returning();

      await publishDomainEvent(
        {
          workspaceId: auth.workspaceId,
          eventType: "document.created",
          aggregateType: "document",
          aggregateId: doc.id,
          actorId: auth.userId,
          payload: {
            documentId: doc.id,
            title: doc.title,
            folderId: doc.folderId,
            isTemplate: doc.isTemplate,
            createdBy: auth.userId,
          },
        },
        tx
      );

      return doc;
    });

    // Auto-index document into AI Zenith RAG memory
    try {
      await indexDocumentFn({
        data: { documentId: newDoc.id, workspaceId: auth.workspaceId },
      });
    } catch {
      // Ingestion error safety: embedding provider failures do not block document creation
    }

    return {
      document: {
        id: newDoc.id,
        workspaceId: newDoc.workspaceId,
        folderId: newDoc.folderId,
        title: newDoc.title,
        contentJson: (newDoc.contentJson || {}) as Record<string, any>,
        isTemplate: newDoc.isTemplate,
        createdBy: newDoc.createdBy,
        createdAt: newDoc.createdAt.toISOString(),
        updatedAt: newDoc.updatedAt.toISOString(),
      },
    };
  });

/**
 * Server Function: updateDocumentFn
 * Updates a document, publishes document.updated event, and re-indexes RAG vector memory.
 */
export const updateDocumentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateDocumentInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const existingDocRows = await db
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

    if (existingDocRows.length === 0) {
      throw new Error("DOCUMENT_NOT_FOUND: Document not found or access denied.");
    }

    if (data.folderId) {
      const folderRows = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.id, data.folderId),
            eq(folders.workspaceId, auth.workspaceId),
            isNull(folders.deletedAt)
          )
        )
        .limit(1);

      if (folderRows.length === 0) {
        throw new Error("FOLDER_NOT_FOUND: Target folder not found or access denied.");
      }
    }

    const { publishDomainEvent } = await import("@/lib/events");

    const updatedDoc = await db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (data.title !== undefined) updateData.title = data.title.trim();
      if (data.contentJson !== undefined) updateData.contentJson = data.contentJson;
      if (data.folderId !== undefined) updateData.folderId = data.folderId;
      if (data.isTemplate !== undefined) updateData.isTemplate = data.isTemplate;

      const [doc] = await tx
        .update(documents)
        .set(updateData)
        .where(
          and(
            eq(documents.id, data.documentId),
            eq(documents.workspaceId, auth.workspaceId)
          )
        )
        .returning();

      await publishDomainEvent(
        {
          workspaceId: auth.workspaceId,
          eventType: "document.updated",
          aggregateType: "document",
          aggregateId: doc.id,
          actorId: auth.userId,
          payload: {
            documentId: doc.id,
            title: doc.title,
            folderId: doc.folderId,
            isTemplate: doc.isTemplate,
          },
        },
        tx
      );

      return doc;
    });

    // Re-index RAG memory on title/content change
    try {
      await indexDocumentFn({
        data: { documentId: updatedDoc.id, workspaceId: auth.workspaceId },
      });
    } catch {
      // Ingestion error safety
    }

    return {
      document: {
        id: updatedDoc.id,
        workspaceId: updatedDoc.workspaceId,
        folderId: updatedDoc.folderId,
        title: updatedDoc.title,
        contentJson: (updatedDoc.contentJson || {}) as Record<string, any>,
        isTemplate: updatedDoc.isTemplate,
        createdBy: updatedDoc.createdBy,
        createdAt: updatedDoc.createdAt.toISOString(),
        updatedAt: updatedDoc.updatedAt.toISOString(),
      },
    };
  });

/**
 * Server Function: deleteDocumentFn
 * Soft-deletes a document and purges its RAG vector memory from ai_memory.
 */
export const deleteDocumentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteDocumentInputSchema.parse(data))
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
      throw new Error("DOCUMENT_NOT_FOUND: Document not found or access denied.");
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(documents)
        .set({ deletedAt: now })
        .where(
          and(
            eq(documents.id, data.documentId),
            eq(documents.workspaceId, auth.workspaceId)
          )
        );

      // Purge associated RAG vector memory from ai_memory
      await tx
        .delete(aiMemory)
        .where(
          and(
            eq(aiMemory.workspaceId, auth.workspaceId),
            eq(aiMemory.entityType, "document"),
            eq(aiMemory.entityId, data.documentId)
          )
        );
    });

    return { success: true, documentId: data.documentId };
  });

/**
 * Server Function: uploadAttachmentFn
 * Records attachment metadata with target entity workspace ownership verification.
 */
export const uploadAttachmentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => uploadAttachmentInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] uploadAttachmentFn cannot execute on client.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // 1. Validate file parameters (size, MIME type, prohibited extensions)
    const validation = validateAttachmentFile({
      fileName: data.fileName,
      fileSizeBytes: data.fileSizeBytes,
      mimeType: data.mimeType,
    });
    if (!validation.valid) {
      throw new Error(`INVALID_FILE: ${validation.error}`);
    }

    const cleanFileName = sanitizeFileName(data.fileName);

    // 2. Validate or auto-generate deterministic, workspace-scoped storagePath
    let finalStoragePath = data.storagePath;
    if (finalStoragePath) {
      if (!verifyStoragePathTenantOwnership(finalStoragePath, auth.workspaceId)) {
        throw new Error("ACCESS_DENIED: Cross-tenant storage path access prohibited.");
      }
    } else {
      finalStoragePath = generateStoragePath({
        workspaceId: auth.workspaceId,
        entityType: data.attachedToType || "document",
        entityId: data.attachedToId || "unfiled",
        fileName: cleanFileName,
      });
    }

    // 3. Verify target attached entity exists and belongs to this workspace
    if (data.attachedToType && data.attachedToId) {
      let targetExists = false;

      if (data.attachedToType === "document") {
        const rows = await db
          .select({ id: documents.id })
          .from(documents)
          .where(
            and(
              eq(documents.id, data.attachedToId),
              eq(documents.workspaceId, auth.workspaceId),
              isNull(documents.deletedAt)
            )
          )
          .limit(1);
        targetExists = rows.length > 0;
      } else if (data.attachedToType === "task") {
        const rows = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.id, data.attachedToId),
              eq(tasks.workspaceId, auth.workspaceId),
              isNull(tasks.deletedAt)
            )
          )
          .limit(1);
        targetExists = rows.length > 0;
      } else if (data.attachedToType === "client") {
        const rows = await db
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(
              eq(clients.id, data.attachedToId),
              eq(clients.workspaceId, auth.workspaceId),
              isNull(clients.deletedAt)
            )
          )
          .limit(1);
        targetExists = rows.length > 0;
      } else if (data.attachedToType === "invoice") {
        const rows = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(
            and(
              eq(invoices.id, data.attachedToId),
              eq(invoices.workspaceId, auth.workspaceId)
            )
          )
          .limit(1);
        targetExists = rows.length > 0;
      }

      if (!targetExists) {
        throw new Error(
          "TARGET_ENTITY_NOT_FOUND: Target attached entity not found or access denied."
        );
      }
    }

    const [newAttachment] = await db
      .insert(attachments)
      .values({
        workspaceId: auth.workspaceId,
        fileName: cleanFileName,
        fileSizeBytes: data.fileSizeBytes,
        mimeType: data.mimeType,
        storagePath: finalStoragePath,
        attachedToType: data.attachedToType || null,
        attachedToId: data.attachedToId || null,
        uploadedBy: auth.userId,
      })
      .returning();

    return {
      attachment: {
        id: newAttachment.id,
        workspaceId: newAttachment.workspaceId,
        fileName: newAttachment.fileName,
        fileSizeBytes: newAttachment.fileSizeBytes,
        mimeType: newAttachment.mimeType,
        storagePath: newAttachment.storagePath,
        attachedToType: newAttachment.attachedToType,
        attachedToId: newAttachment.attachedToId,
        uploadedBy: newAttachment.uploadedBy,
        createdAt: newAttachment.createdAt.toISOString(),
      },
    };
  });

/**
 * Server Function: deleteAttachmentFn
 * Soft-deletes attachment metadata and triggers physical storage cleanup.
 */
export const deleteAttachmentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteAttachmentInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] deleteAttachmentFn cannot execute on client.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const [attachment] = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.id, data.attachmentId),
          eq(attachments.workspaceId, auth.workspaceId),
          isNull(attachments.deletedAt)
        )
      )
      .limit(1);

    if (!attachment) {
      throw new Error("ATTACHMENT_NOT_FOUND: Attachment not found or access denied.");
    }

    const now = new Date();
    await db
      .update(attachments)
      .set({ deletedAt: now })
      .where(eq(attachments.id, attachment.id));

    // Best-effort cleanup of physical storage
    await deleteStorageObject({
      workspaceId: auth.workspaceId,
      storagePath: attachment.storagePath,
    });

    return { success: true, attachmentId: attachment.id };
  });

/**
 * Server Function: getAttachmentDownloadUrlFn
 * Resolves a signed download URL or reports transparent metadata-only status.
 */
export const getAttachmentDownloadUrlFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => getAttachmentDownloadUrlInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] getAttachmentDownloadUrlFn cannot execute on client.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const [attachment] = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.id, data.attachmentId),
          eq(attachments.workspaceId, auth.workspaceId),
          isNull(attachments.deletedAt)
        )
      )
      .limit(1);

    if (!attachment) {
      throw new Error("ATTACHMENT_NOT_FOUND: Attachment not found or access denied.");
    }

    const downloadResult = await requestSignedDownloadUrl({
      workspaceId: auth.workspaceId,
      storagePath: attachment.storagePath,
    });

    return {
      isAvailable: downloadResult.isAvailable,
      mode: downloadResult.mode,
      downloadUrl: downloadResult.downloadUrl || null,
      fileName: attachment.fileName,
      fileSizeBytes: attachment.fileSizeBytes,
      mimeType: attachment.mimeType,
      storagePath: attachment.storagePath,
      notice: downloadResult.notice || downloadResult.error || null,
    };
  });

/**
 * Server Function: getStorageConfigFn
 * Retrieves current storage provider capabilities, mode, and student notice.
 */
export const getStorageConfigFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getStorageConfigInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] getStorageConfigFn cannot execute on client.");
    }

    await requireWorkspaceAccess({ workspaceId: data?.workspaceId });
    const status = await getStorageStatusInfo();
    return status;
  });
