/**
 * SILEX 2.0 — Storage Subsystem Entrypoint & Provider Factory
 *
 * Implements a clean vendor-neutral storage boundary.
 * Defaults safely to DisabledStorageProvider ($0 student mode) when physical
 * cloud storage is not provisioned. Supports LocalDevStorageProvider for local
 * development and SupabaseStorageProvider for production.
 */

import { DisabledStorageProvider } from "./providers/disabled";
import { LocalDevStorageProvider } from "./providers/local";
import { SupabaseStorageProvider } from "./providers/supabase";
import type {
  DeleteObjectParams,
  DeleteObjectResult,
  SignedDownloadUrlParams,
  SignedDownloadResult,
  SignedUploadUrlParams,
  SignedUploadResult,
  StorageMode,
  StorageProvider,
  StorageStatusInfo,
} from "./types";

export * from "./types";
export * from "./validation";
export { DisabledStorageProvider } from "./providers/disabled";
export { LocalDevStorageProvider } from "./providers/local";
export { SupabaseStorageProvider } from "./providers/supabase";

let activeProvider: StorageProvider | null = null;

/**
 * Resolves the active StorageProvider singleton based on environment configuration.
 *
 * Evaluation Order:
 * 1. process.env.STORAGE_MODE === "local" -> LocalDevStorageProvider
 * 2. process.env.STORAGE_MODE === "supabase" (or active SUPABASE_SERVICE_ROLE_KEY) -> SupabaseStorageProvider
 * 3. Default fallback: DisabledStorageProvider ($0 invariant, metadata-only mode)
 */
export function getStorageProvider(overrideMode?: StorageMode): StorageProvider {
  if (overrideMode) {
    switch (overrideMode) {
      case "local":
        return new LocalDevStorageProvider();
      case "supabase":
        return new SupabaseStorageProvider();
      case "disabled":
      default:
        return new DisabledStorageProvider();
    }
  }

  if (activeProvider) {
    return activeProvider;
  }

  const configuredMode = (
    process.env.STORAGE_MODE ||
    process.env.VITE_STORAGE_MODE ||
    "disabled"
  ).toLowerCase() as StorageMode;

  if (configuredMode === "local") {
    activeProvider = new LocalDevStorageProvider();
  } else if (configuredMode === "supabase") {
    activeProvider = new SupabaseStorageProvider();
  } else {
    // Default safe $0 student mode
    activeProvider = new DisabledStorageProvider();
  }

  return activeProvider;
}

/**
 * Resets the cached active provider instance (primarily useful for test environments).
 */
export function resetStorageProvider(): void {
  activeProvider = null;
}

/**
 * Convenient wrapper for obtaining current storage status.
 */
export async function getStorageStatusInfo(
  overrideMode?: StorageMode
): Promise<StorageStatusInfo> {
  const provider = getStorageProvider(overrideMode);
  return provider.getStorageStatus();
}

/**
 * Convenient wrapper for requesting a signed upload URL.
 */
export async function requestSignedUploadUrl(
  params: SignedUploadUrlParams,
  overrideMode?: StorageMode
): Promise<SignedUploadResult> {
  const provider = getStorageProvider(overrideMode);
  return provider.getSignedUploadUrl(params);
}

/**
 * Convenient wrapper for requesting a signed download URL.
 */
export async function requestSignedDownloadUrl(
  params: SignedDownloadUrlParams,
  overrideMode?: StorageMode
): Promise<SignedDownloadResult> {
  const provider = getStorageProvider(overrideMode);
  return provider.getSignedDownloadUrl(params);
}

/**
 * Convenient wrapper for deleting a storage object.
 */
export async function deleteStorageObject(
  params: DeleteObjectParams,
  overrideMode?: StorageMode
): Promise<DeleteObjectResult> {
  const provider = getStorageProvider(overrideMode);
  return provider.deleteObject(params);
}
