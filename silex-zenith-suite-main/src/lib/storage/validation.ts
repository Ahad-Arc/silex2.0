/**
 * SILEX 2.0 — Storage Validation & Path Safety Utilities
 *
 * Enforces file safety, directory traversal prevention, MIME allowlists,
 * and deterministic workspace partitioning.
 */

import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES,
  PROHIBITED_FILE_EXTENSIONS,
} from "./types";

/**
 * Sanitizes an untrusted user-supplied file name:
 * 1. Strips path traversal sequences (../, ..\, /)
 * 2. Removes ASCII control characters and null bytes
 * 3. Restricts length to maximum 200 characters while preserving extension
 * 4. Ensures fallback to a safe default if name is empty or illegal
 */
export function sanitizeFileName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") {
    return "attachment.bin";
  }

  // 1. Remove null bytes and ASCII control characters
  let clean = rawName
    .replace(/\0/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim();

  // 2. Remove directory traversal sequences (e.g. ../ or ..\)
  clean = clean.replace(/(\.\.[/\\]|[/\\]\.\.)+/g, "");

  // 3. Replace directory separators with underscores
  clean = clean.replace(/[/\\]+/g, "_");

  // 4. Strip leading dots, underscores, or dashes (hidden files / leftover separators)
  clean = clean.replace(/^[._\-]+/, "");

  if (!clean || clean === ".") {
    return "attachment.bin";
  }

  // 5. Enforce max length (200 chars) preserving extension
  if (clean.length > 200) {
    const extIndex = clean.lastIndexOf(".");
    if (extIndex > 0 && extIndex > clean.length - 20) {
      const ext = clean.substring(extIndex);
      const base = clean.substring(0, 200 - ext.length);
      clean = `${base}${ext}`;
    } else {
      clean = clean.substring(0, 200);
    }
  }

  return clean;
}

/**
 * Validates file parameters against security rules, size limits, and MIME allowlists.
 */
export function validateAttachmentFile(params: {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  maxSizeBytes?: number;
  allowedMimeTypes?: readonly string[];
}): { valid: boolean; error?: string } {
  const { fileName, fileSizeBytes, mimeType } = params;
  const maxBytes = params.maxSizeBytes ?? MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES;
  const allowedMimes = params.allowedMimeTypes ?? ALLOWED_DOCUMENT_MIME_TYPES;

  // 1. File name checks
  if (!fileName || typeof fileName !== "string" || fileName.trim().length === 0) {
    return { valid: false, error: "File name is required and cannot be empty." };
  }

  const lowerName = fileName.toLowerCase().trim();

  // Check prohibited extensions
  for (const prohibited of PROHIBITED_FILE_EXTENSIONS) {
    if (lowerName.endsWith(prohibited)) {
      return {
        valid: false,
        error: `Executable or script file type "${prohibited}" is strictly prohibited for security.`,
      };
    }
  }

  // 2. File size checks
  if (typeof fileSizeBytes !== "number" || isNaN(fileSizeBytes) || fileSizeBytes <= 0) {
    return { valid: false, error: "File size must be a positive integer in bytes." };
  }

  if (fileSizeBytes > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File size exceeds the maximum limit of ${maxMb}MB.`,
    };
  }

  // 3. MIME type checks
  if (!mimeType || typeof mimeType !== "string" || mimeType.trim().length === 0) {
    return { valid: false, error: "MIME type is required." };
  }

  const cleanMime = mimeType.toLowerCase().trim();
  const isAllowed = allowedMimes.some((allowed) => {
    if (allowed.endsWith("/*")) {
      const prefix = allowed.slice(0, -1);
      return cleanMime.startsWith(prefix);
    }
    return cleanMime === allowed;
  });

  if (!isAllowed) {
    return {
      valid: false,
      error: `File type "${mimeType}" is not supported. Supported types: PDF, Images (PNG, JPG, WebP, SVG), Office docs, and plain text.`,
    };
  }

  return { valid: true };
}

/**
 * Generates a deterministic, strictly workspace-partitioned storage path:
 * `{workspaceId}/{entityType}/{entityId}/{timestamp}-{randomToken}-{sanitizedFileName}`
 */
export function generateStoragePath(params: {
  workspaceId: string;
  entityType?: string;
  entityId?: string;
  fileName: string;
}): string {
  const { workspaceId } = params;
  const entityType = params.entityType ? params.entityType.replace(/[^a-zA-Z0-9_-]/g, "") : "general";
  const entityId = params.entityId ? params.entityId.replace(/[^a-zA-Z0-9_-]/g, "") : "unfiled";
  const cleanName = sanitizeFileName(params.fileName);

  // Generate random 12-char hex token
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now();

  return `${workspaceId}/${entityType}/${entityId}/${timestamp}_${randomSuffix}_${cleanName}`;
}

/**
 * Verifies that a storage path is safely scoped to the caller's authorized workspaceId.
 * Guarantees that Tenant A cannot access, mutate, or download Tenant B's storage path.
 */
export function verifyStoragePathTenantOwnership(
  storagePath: string,
  workspaceId: string
): boolean {
  if (!storagePath || typeof storagePath !== "string" || !workspaceId) {
    return false;
  }

  // Reject path traversal attempts
  if (storagePath.includes("..") || storagePath.includes("\\") || storagePath.includes("\0")) {
    return false;
  }

  const normalized = storagePath.replace(/^\/+/, "");
  const expectedPrefix = `${workspaceId}/`;

  return normalized.startsWith(expectedPrefix);
}
