/**
 * SILEX AI Zenith — Text Normalization & Deterministic Chunking Engine
 * 
 * Provides deterministic source text extraction, whitespace normalization,
 * content hashing, and semantic sentence-aware chunking for vector ingestion.
 */

import { createHash } from "node:crypto";


export interface ChunkOptions {
  workspaceId: string;
  entityType: "document" | "task" | "client_note";
  entityId: string;
  sourceTitle?: string;
  rawText: string;
  maxChunkSize?: number; // Target max characters per chunk (default 800)
  overlapSize?: number;  // Character overlap between adjacent chunks (default 150)
}

export interface FormattedChunk {
  workspaceId: string;
  entityType: string;
  entityId: string;
  chunkIndex: number;
  chunkContent: string;
  contentHash: string;
  metadata: {
    sourceTitle?: string;
    entityType: string;
    entityId: string;
    chunkIndex: number;
    totalChunks: number;
    contentHash: string;
  };
}

/**
 * Normalizes text by removing meaningless noise while preserving structure.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Generates a deterministic SHA-256 hash of normalized content.
 */
export function computeContentHash(text: string): string {
  const normalized = normalizeText(text);
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Extracts plain text from document content JSON or raw string.
 */
export function extractDocumentText(title: string, contentJson: unknown): string {
  let contentText = "";

  if (typeof contentJson === "string") {
    contentText = contentJson;
  } else if (contentJson && typeof contentJson === "object") {
    try {
      // Recursively extract text nodes if ProseMirror/TipTap format or generic JSON
      const extractNodes = (obj: unknown): string => {
        if (!obj) return "";
        if (typeof obj === "string") return obj;
        if (Array.isArray(obj)) return obj.map(extractNodes).join(" ");
        if (typeof obj === "object") {
          const rec = obj as Record<string, unknown>;
          if (rec.text && typeof rec.text === "string") return rec.text;
          return Object.values(rec).map(extractNodes).join(" ");
        }
        return "";
      };
      contentText = extractNodes(contentJson);
    } catch {
      contentText = JSON.stringify(contentJson);
    }
  }

  const combined = `Document Title: ${title}\n\nContent:\n${contentText}`;
  return normalizeText(combined);
}

/**
 * Formats task details into a meaningful textual representation for embedding.
 */
export function extractTaskText(task: {
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: Date | string | null;
}): string {
  const parts: string[] = [
    `Task: ${task.title}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
  ];

  if (task.description && task.description.trim()) {
    parts.push(`Description: ${task.description.trim()}`);
  }

  if (task.dueDate) {
    const formattedDate =
      task.dueDate instanceof Date
        ? task.dueDate.toISOString().split("T")[0]
        : String(task.dueDate).split("T")[0];
    parts.push(`Due Date: ${formattedDate}`);
  }

  return normalizeText(parts.join("\n"));
}

/**
 * Formats CRM client note into a meaningful textual representation for embedding.
 */
export function extractClientNoteText(note: {
  content: string;
  isPinned?: boolean;
  clientCompanyName?: string;
}): string {
  const parts: string[] = [];

  if (note.clientCompanyName) {
    parts.push(`Client: ${note.clientCompanyName}`);
  }

  parts.push(`Client Note: ${note.content}`);

  if (note.isPinned) {
    parts.push("Status: Pinned Note");
  }

  return normalizeText(parts.join("\n"));
}

/**
 * Deterministically splits normalized text into bounded chunks with sentence preservation.
 */
export function chunkText(options: ChunkOptions): FormattedChunk[] {
  const {
    workspaceId,
    entityType,
    entityId,
    sourceTitle,
    rawText,
    maxChunkSize = 800,
    overlapSize = 150,
  } = options;

  const normalized = normalizeText(rawText);
  if (!normalized) {
    return [];
  }

  const fullContentHash = computeContentHash(normalized);

  // If content is small enough, return as a single chunk
  if (normalized.length <= maxChunkSize) {
    return [
      {
        workspaceId,
        entityType,
        entityId,
        chunkIndex: 0,
        chunkContent: normalized,
        contentHash: fullContentHash,
        metadata: {
          sourceTitle,
          entityType,
          entityId,
          chunkIndex: 0,
          totalChunks: 1,
          contentHash: fullContentHash,
        },
      },
    ];
  }

  // Split into paragraphs / sentences
  const paragraphs = normalized.split(/\n\n+/);
  const rawChunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + "\n\n" + para).length <= maxChunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
    } else {
      if (currentChunk) {
        rawChunks.push(currentChunk);
      }
      // If a single paragraph exceeds maxChunkSize, split by sentences
      if (para.length > maxChunkSize) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        let sentenceChunk = "";
        for (const sentence of sentences) {
          if ((sentenceChunk + " " + sentence).length <= maxChunkSize) {
            sentenceChunk = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
          } else {
            if (sentenceChunk) rawChunks.push(sentenceChunk);
            sentenceChunk = sentence;
          }
        }
        if (sentenceChunk) {
          currentChunk = sentenceChunk;
        } else {
          currentChunk = "";
        }
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk) {
    rawChunks.push(currentChunk);
  }

  // Apply overlap adjustments where chunks cut context
  const finalChunks: FormattedChunk[] = rawChunks.map((content, idx) => {
    let paddedContent = content;
    if (idx > 0 && overlapSize > 0) {
      const prevChunk = rawChunks[idx - 1];
      const overlapText = prevChunk.slice(-overlapSize);
      if (!paddedContent.startsWith(overlapText)) {
        paddedContent = `...${overlapText}\n${paddedContent}`;
      }
    }

    return {
      workspaceId,
      entityType,
      entityId,
      chunkIndex: idx,
      chunkContent: paddedContent,
      contentHash: fullContentHash,
      metadata: {
        sourceTitle,
        entityType,
        entityId,
        chunkIndex: idx,
        totalChunks: rawChunks.length,
        contentHash: fullContentHash,
      },
    };
  });

  return finalChunks;
}
