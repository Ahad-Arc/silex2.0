/**
 * SILEX 2.0 — Supabase Storage Provider (Optional Production Adapter)
 *
 * Production adapter for Supabase Storage buckets (silex-documents, silex-avatars).
 * Gracefully handles unprovisioned bucket states without throwing or blocking local development.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
import { getSupabaseEnv } from "@/lib/supabase/config";

export class SupabaseStorageProvider implements StorageProvider {
  readonly mode = "supabase" as const;
  readonly providerName = "Supabase Cloud Storage";

  private client: SupabaseClient | null = null;
  private defaultBucket: string;

  constructor(bucket: string = SILEX_STORAGE_BUCKETS.DOCUMENTS) {
    this.defaultBucket = bucket;
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const apiKey = serviceRoleKey || supabaseAnonKey;
    if (supabaseUrl && apiKey) {
      try {
        this.client = createClient(supabaseUrl, apiKey, {
          auth: { persistSession: false },
        });
      } catch {
        this.client = null;
      }
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  getStorageStatus(): StorageStatusInfo {
    return {
      mode: "supabase",
      isConfigured: this.isConfigured,
      providerName: this.providerName,
      bucket: this.defaultBucket,
      maxFileSizeBytes: MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_DOCUMENT_MIME_TYPES,
      notice: this.isConfigured
        ? "Supabase Cloud Storage is configured and ready for physical file uploads."
        : "Supabase credentials are not fully configured. Cloud storage is currently inactive.",
    };
  }

  async getSignedUploadUrl(
    params: SignedUploadUrlParams
  ): Promise<SignedUploadResult> {
    if (!this.client) {
      return {
        success: false,
        mode: "supabase",
        storagePath: params.storagePath,
        bucket: params.bucket || this.defaultBucket,
        error:
          "STORAGE_UNCONFIGURED: Supabase Storage client is uninitialized. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      };
    }

    if (!verifyStoragePathTenantOwnership(params.storagePath, params.workspaceId)) {
      return {
        success: false,
        mode: "supabase",
        storagePath: params.storagePath,
        bucket: params.bucket || this.defaultBucket,
        error: "ACCESS_DENIED: Cross-tenant storage path access prohibited.",
      };
    }

    const bucketName = params.bucket || this.defaultBucket;

    try {
      const { data, error } = await this.client.storage
        .from(bucketName)
        .createSignedUploadUrl(params.storagePath);

      if (error || !data) {
        return {
          success: false,
          mode: "supabase",
          storagePath: params.storagePath,
          bucket: bucketName,
          error: `SUPABASE_STORAGE_ERROR: ${error?.message || "Failed to create signed upload URL. Verify bucket exists."}`,
        };
      }

      return {
        success: true,
        mode: "supabase",
        storagePath: params.storagePath,
        bucket: bucketName,
        uploadUrl: data.signedUrl,
        token: data.token,
      };
    } catch (err) {
      return {
        success: false,
        mode: "supabase",
        storagePath: params.storagePath,
        bucket: bucketName,
        error: `SUPABASE_STORAGE_EXCEPTION: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async getSignedDownloadUrl(
    params: SignedDownloadUrlParams
  ): Promise<SignedDownloadResult> {
    if (!this.client) {
      return {
        success: false,
        mode: "supabase",
        storagePath: params.storagePath,
        isAvailable: false,
        error: "STORAGE_UNCONFIGURED: Supabase Storage client is uninitialized.",
      };
    }

    if (!verifyStoragePathTenantOwnership(params.storagePath, params.workspaceId)) {
      return {
        success: false,
        mode: "supabase",
        storagePath: params.storagePath,
        isAvailable: false,
        error: "ACCESS_DENIED: Cross-tenant storage path access prohibited.",
      };
    }

    const bucketName = params.bucket || this.defaultBucket;
    const expiresIn = params.expiresInSeconds || 3600;

    try {
      const { data, error } = await this.client.storage
        .from(bucketName)
        .createSignedUrl(params.storagePath, expiresIn);

      if (error || !data) {
        return {
          success: false,
          mode: "supabase",
          storagePath: params.storagePath,
          isAvailable: false,
          error: `SUPABASE_STORAGE_ERROR: ${error?.message || "Failed to generate signed download URL."}`,
        };
      }

      return {
        success: true,
        mode: "supabase",
        storagePath: params.storagePath,
        downloadUrl: data.signedUrl,
        isAvailable: true,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        mode: "supabase",
        storagePath: params.storagePath,
        isAvailable: false,
        error: `SUPABASE_STORAGE_EXCEPTION: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async deleteObject(params: DeleteObjectParams): Promise<DeleteObjectResult> {
    if (!this.client) {
      return { success: false, error: "STORAGE_UNCONFIGURED: Supabase client uninitialized." };
    }

    if (!verifyStoragePathTenantOwnership(params.storagePath, params.workspaceId)) {
      return { success: false, error: "ACCESS_DENIED: Cross-tenant storage path access prohibited." };
    }

    const bucketName = params.bucket || this.defaultBucket;

    try {
      const { error } = await this.client.storage
        .from(bucketName)
        .remove([params.storagePath]);

      if (error) {
        return { success: false, error: `SUPABASE_STORAGE_ERROR: ${error.message}` };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `SUPABASE_STORAGE_EXCEPTION: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
