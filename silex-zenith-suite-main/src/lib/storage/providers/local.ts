/**
 * SILEX 2.0 — Local Development Storage Provider
 *
 * Provides a local filesystem sandbox for development without external cloud dependencies.
 * Never writes binary data to PostgreSQL. Enforces strict directory isolation.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  DeleteObjectParams,
  DeleteObjectResult,
  SignedDownloadUrlParams,
  SignedDownloadResult,
  SignedUploadUrlParams,
  SignedUploadResult,
  StorageProvider,
  StorageStatusInfo,
} from "../types";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES,
  SILEX_STORAGE_BUCKETS,
} from "../types";
import { verifyStoragePathTenantOwnership } from "../validation";

export class LocalDevStorageProvider implements StorageProvider {
  readonly mode = "local" as const;
  readonly isConfigured = true;
  readonly providerName = "Local Filesystem Sandbox";

  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir =
      customBaseDir ||
      process.env.LOCAL_STORAGE_DIR ||
      path.join(process.cwd(), ".silex-storage");
  }

  private resolveSafePath(workspaceId: string, storagePath: string): string | null {
    if (!verifyStoragePathTenantOwnership(storagePath, workspaceId)) {
      return null;
    }

    const cleanRelPath = storagePath.replace(/^\/+/, "");
    const absolutePath = path.resolve(this.baseDir, cleanRelPath);

    // Prevent path traversal outside the baseDir
    if (!absolutePath.startsWith(path.resolve(this.baseDir))) {
      return null;
    }

    return absolutePath;
  }

  getStorageStatus(): StorageStatusInfo {
    return {
      mode: "local",
      isConfigured: true,
      providerName: this.providerName,
      bucket: SILEX_STORAGE_BUCKETS.DOCUMENTS,
      maxFileSizeBytes: MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_DOCUMENT_MIME_TYPES,
      notice:
        "Local filesystem storage is active for local development. Files are stored in a local directory partitioned by workspace.",
    };
  }

  async getSignedUploadUrl(
    params: SignedUploadUrlParams
  ): Promise<SignedUploadResult> {
    const targetPath = this.resolveSafePath(params.workspaceId, params.storagePath);
    if (!targetPath) {
      return {
        success: false,
        mode: "local",
        storagePath: params.storagePath,
        bucket: params.bucket || SILEX_STORAGE_BUCKETS.DOCUMENTS,
        error: "ACCESS_DENIED: Invalid storage path or cross-tenant access prohibited.",
      };
    }

    // Ensure target folder exists
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      return {
        success: false,
        mode: "local",
        storagePath: params.storagePath,
        bucket: params.bucket || SILEX_STORAGE_BUCKETS.DOCUMENTS,
        error: `LOCAL_STORAGE_ERROR: Failed to prepare directory: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    return {
      success: true,
      mode: "local",
      storagePath: params.storagePath,
      bucket: params.bucket || SILEX_STORAGE_BUCKETS.DOCUMENTS,
      uploadUrl: `/api/storage/dev?path=${encodeURIComponent(params.storagePath)}`,
    };
  }

  async getSignedDownloadUrl(
    params: SignedDownloadUrlParams
  ): Promise<SignedDownloadResult> {
    const targetPath = this.resolveSafePath(params.workspaceId, params.storagePath);
    if (!targetPath) {
      return {
        success: false,
        mode: "local",
        storagePath: params.storagePath,
        isAvailable: false,
        error: "ACCESS_DENIED: Invalid storage path or cross-tenant access prohibited.",
      };
    }

    const exists = fs.existsSync(targetPath);
    if (!exists) {
      return {
        success: false,
        mode: "local",
        storagePath: params.storagePath,
        isAvailable: false,
        notice: "File was recorded locally but is not currently present on disk.",
        error: "FILE_NOT_FOUND: Physical file does not exist in local storage sandbox.",
      };
    }

    return {
      success: true,
      mode: "local",
      storagePath: params.storagePath,
      isAvailable: true,
      downloadUrl: `/api/storage/dev?path=${encodeURIComponent(params.storagePath)}`,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  }

  async deleteObject(params: DeleteObjectParams): Promise<DeleteObjectResult> {
    const targetPath = this.resolveSafePath(params.workspaceId, params.storagePath);
    if (!targetPath) {
      return { success: false, error: "ACCESS_DENIED: Invalid storage path." };
    }

    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `LOCAL_STORAGE_ERROR: Failed to delete file: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
