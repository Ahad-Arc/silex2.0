/**
 * SILEX 2.0 — Storage & Media Abstraction Types & Constants
 *
 * Defines the vendor-neutral storage provider contract, canonical bucket definitions,
 * file validation constraints, and student-friendly $0 storage invariants.
 */

export type StorageMode = "disabled" | "local" | "supabase";

export interface StorageStatusInfo {
  mode: StorageMode;
  isConfigured: boolean;
  providerName: string;
  bucket: string;
  maxFileSizeBytes: number;
  allowedMimeTypes: readonly string[];
  notice: string;
}

export interface SignedUploadUrlParams {
  workspaceId: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  bucket?: string;
  expiresInSeconds?: number;
}

export interface SignedUploadResult {
  success: boolean;
  mode: StorageMode;
  storagePath: string;
  bucket: string;
  uploadUrl?: string;
  token?: string;
  headers?: Record<string, string>;
  error?: string;
}

export interface SignedDownloadUrlParams {
  workspaceId: string;
  storagePath: string;
  bucket?: string;
  expiresInSeconds?: number;
}

export interface SignedDownloadResult {
  success: boolean;
  mode: StorageMode;
  storagePath: string;
  downloadUrl?: string;
  expiresAt?: string;
  isAvailable: boolean;
  notice?: string;
  error?: string;
}

export interface DeleteObjectParams {
  workspaceId: string;
  storagePath: string;
  bucket?: string;
}

export interface DeleteObjectResult {
  success: boolean;
  error?: string;
}

/**
 * StorageProvider Interface
 * Abstracts cloud and local file storage operations so physical storage can be
 * enabled, swapped, or omitted without rewriting core document business logic.
 */
export interface StorageProvider {
  readonly mode: StorageMode;
  readonly isConfigured: boolean;
  readonly providerName: string;

  getStorageStatus(): Promise<StorageStatusInfo> | StorageStatusInfo;
  getSignedUploadUrl(params: SignedUploadUrlParams): Promise<SignedUploadResult>;
  getSignedDownloadUrl(params: SignedDownloadUrlParams): Promise<SignedDownloadResult>;
  deleteObject(params: DeleteObjectParams): Promise<DeleteObjectResult>;
}

/**
 * Canonical Silex Storage Buckets
 */
export const SILEX_STORAGE_BUCKETS = {
  DOCUMENTS: "silex-documents",
  AVATARS: "silex-avatars",
  EXPORTS: "silex-exports",
} as const;

export type SilexStorageBucket =
  (typeof SILEX_STORAGE_BUCKETS)[keyof typeof SILEX_STORAGE_BUCKETS];

/**
 * Maximum File Size Limits
 */
export const MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB absolute cap

/**
 * Canonical Allowed MIME Types
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/**
 * Dangerous / Prohibited Executable Extensions
 */
export const PROHIBITED_FILE_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".bash",
  ".vbs",
  ".js",
  ".mjs",
  ".cjs",
  ".php",
  ".py",
  ".ps1",
  ".com",
  ".scr",
  ".pif",
  ".jar",
  ".msi",
  ".reg",
] as const;
