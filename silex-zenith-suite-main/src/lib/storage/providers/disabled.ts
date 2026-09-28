/**
 * SILEX 2.0 — Disabled / Metadata-Only Storage Provider
 *
 * Safe student-friendly default when physical cloud storage is unprovisioned.
 * Guarantees $0 infrastructure cost, prevents fake successful uploads,
 * and maintains honest system status.
 */

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

export class DisabledStorageProvider implements StorageProvider {
  readonly mode = "disabled" as const;
  readonly isConfigured = false;
  readonly providerName = "Metadata-Only ($0 Invariant)";

  getStorageStatus(): StorageStatusInfo {
    return {
      mode: "disabled",
      isConfigured: false,
      providerName: this.providerName,
      bucket: SILEX_STORAGE_BUCKETS.DOCUMENTS,
      maxFileSizeBytes: MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_DOCUMENT_MIME_TYPES,
      notice:
        "Physical cloud storage is not provisioned ($0 mode). Attachments are managed in metadata-only mode without binary cloud storage costs.",
    };
  }

  async getSignedUploadUrl(
    params: SignedUploadUrlParams
  ): Promise<SignedUploadResult> {
    return {
      success: false,
      mode: "disabled",
      storagePath: params.storagePath,
      bucket: params.bucket || SILEX_STORAGE_BUCKETS.DOCUMENTS,
      error:
        "STORAGE_UNCONFIGURED: Physical cloud storage is not provisioned. Attachment metadata was recorded, but physical binary upload is disabled.",
    };
  }

  async getSignedDownloadUrl(
    params: SignedDownloadUrlParams
  ): Promise<SignedDownloadResult> {
    return {
      success: false,
      mode: "disabled",
      storagePath: params.storagePath,
      isAvailable: false,
      notice:
        "Physical file was not stored in cloud storage (system operating in $0 metadata-only mode).",
      error:
        "STORAGE_UNCONFIGURED: Binary file is unavailable because physical cloud storage is not provisioned.",
    };
  }

  async deleteObject(_params: DeleteObjectParams): Promise<DeleteObjectResult> {
    // In metadata-only mode, physical file does not exist, so deletion succeeds as a no-op
    return { success: true };
  }
}
