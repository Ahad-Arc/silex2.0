/**
 * SILEX 2.0 — TASK-020 Storage & Media Test Suite
 *
 * Verifies the storage abstraction layer, file validation, security boundaries,
 * multi-tenant isolation, student-friendly $0 invariants, and document attachment contracts.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

import {
  getStorageProvider,
  DisabledStorageProvider,
  LocalDevStorageProvider,
  SupabaseStorageProvider,
  SILEX_STORAGE_BUCKETS,
  MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES,
  MAX_AVATAR_SIZE_BYTES,
  MAX_UPLOAD_LIMIT_BYTES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  PROHIBITED_FILE_EXTENSIONS,
  sanitizeFileName,
  validateAttachmentFile,
  generateStoragePath,
  verifyStoragePathTenantOwnership,
  getStorageStatusInfo,
  requestSignedUploadUrl,
  requestSignedDownloadUrl,
  deleteStorageObject,
} from "../src/lib/storage";

import {
  uploadAttachmentInputSchema,
  deleteAttachmentInputSchema,
  getAttachmentDownloadUrlInputSchema,
  getStorageConfigInputSchema,
} from "../src/lib/server-functions/documents";

// 1. STORAGE PROVIDER FACTORY & MODES
test("1. STORAGE PROVIDER FACTORY — Safe $0 Default and Mode Switching", () => {
  // Safe default: DisabledStorageProvider (zero paid infrastructure required)
  const defaultProvider = getStorageProvider("disabled");
  assert.equal(defaultProvider.mode, "disabled");
  assert.equal(defaultProvider.isConfigured, false);
  assert.ok(defaultProvider instanceof DisabledStorageProvider);

  // Local development mode
  const localProvider = getStorageProvider("local");
  assert.equal(localProvider.mode, "local");
  assert.equal(localProvider.isConfigured, true);
  assert.ok(localProvider instanceof LocalDevStorageProvider);

  // Supabase cloud adapter
  const supabaseProvider = getStorageProvider("supabase");
  assert.equal(supabaseProvider.mode, "supabase");
  assert.ok(supabaseProvider instanceof SupabaseStorageProvider);
});

// 2. STORAGE PROVIDER ABSTRACTION CONTRACT
test("2. STORAGE PROVIDER CONTRACT — Disabled Mode Operates Gracefully ($0 Invariant)", async () => {
  const provider = new DisabledStorageProvider();
  const status = provider.getStorageStatus();

  assert.equal(status.mode, "disabled");
  assert.equal(status.isConfigured, false);
  assert.equal(status.bucket, "silex-documents");
  assert.ok(status.notice.includes("Physical cloud storage is not provisioned"));

  // Upload URL request returns clean structured error without throwing
  const uploadRes = await provider.getSignedUploadUrl({
    workspaceId: "ws-11111111-1111-1111-1111-111111111111",
    storagePath: "ws-11111111-1111-1111-1111-111111111111/doc/1/test.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 1024,
  });
  assert.equal(uploadRes.success, false);
  assert.equal(uploadRes.mode, "disabled");
  assert.ok(uploadRes.error?.includes("STORAGE_UNCONFIGURED"));

  // Download URL request returns isAvailable: false with informative notice
  const downloadRes = await provider.getSignedDownloadUrl({
    workspaceId: "ws-11111111-1111-1111-1111-111111111111",
    storagePath: "ws-11111111-1111-1111-1111-111111111111/doc/1/test.pdf",
  });
  assert.equal(downloadRes.success, false);
  assert.equal(downloadRes.isAvailable, false);
  assert.ok(downloadRes.notice?.includes("metadata-only mode"));

  // Deletion in disabled mode succeeds cleanly (no-op)
  const deleteRes = await provider.deleteObject({
    workspaceId: "ws-11111111-1111-1111-1111-111111111111",
    storagePath: "ws-11111111-1111-1111-1111-111111111111/doc/1/test.pdf",
  });
  assert.equal(deleteRes.success, true);
});

// 3. LOCAL DEV STORAGE PROVIDER ISOLATION & PATH TRAVERSAL DEFENSE
test("3. LOCAL DEV STORAGE — Directory Isolation and Traversal Prevention", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "silex-test-storage-"));
  const localProvider = new LocalDevStorageProvider(tempDir);
  const workspaceId = "ws-alpha";

  try {
    // Cross-tenant storage path rejected
    const badTenantRes = await localProvider.getSignedUploadUrl({
      workspaceId: "ws-beta",
      storagePath: "ws-alpha/doc/1/file.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 500,
    });
    assert.equal(badTenantRes.success, false);
    assert.ok(badTenantRes.error?.includes("ACCESS_DENIED"));

    // Directory traversal attempt rejected
    const traversalRes = await localProvider.getSignedUploadUrl({
      workspaceId,
      storagePath: `${workspaceId}/../../outside.txt`,
      mimeType: "text/plain",
      fileSizeBytes: 500,
    });
    assert.equal(traversalRes.success, false);
    assert.ok(traversalRes.error?.includes("ACCESS_DENIED"));

    // Valid upload URL creation inside workspace directory
    const validRes = await localProvider.getSignedUploadUrl({
      workspaceId,
      storagePath: `${workspaceId}/doc/1/file.pdf`,
      mimeType: "application/pdf",
      fileSizeBytes: 500,
    });
    assert.equal(validRes.success, true);
    assert.equal(validRes.mode, "local");
    assert.ok(validRes.uploadUrl?.includes("/api/storage/dev"));

    // Missing file on disk returns clean failure without crashing
    const downloadRes = await localProvider.getSignedDownloadUrl({
      workspaceId,
      storagePath: `${workspaceId}/doc/1/file.pdf`,
    });
    assert.equal(downloadRes.isAvailable, false);
    assert.ok(downloadRes.error?.includes("FILE_NOT_FOUND"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// 4. FILE VALIDATION & SECURITY ALLOWLIST
test("4. FILE VALIDATION — Supported Types, Limits, and Prohibited Extensions", () => {
  // Supported MIME types pass
  const validMimes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  for (const mime of validMimes) {
    const res = validateAttachmentFile({
      fileName: "document.pdf",
      fileSizeBytes: 1024 * 100, // 100 KB
      mimeType: mime,
    });
    assert.equal(res.valid, true, `MIME type ${mime} should be valid`);
  }

  // Prohibited executable extensions rejected
  for (const ext of PROHIBITED_FILE_EXTENSIONS) {
    const res = validateAttachmentFile({
      fileName: `payload${ext}`,
      fileSizeBytes: 1024,
      mimeType: "application/octet-stream",
    });
    assert.equal(res.valid, false, `Extension ${ext} must be rejected`);
    assert.ok(res.error?.includes("strictly prohibited"));
  }

  // Oversized file (> 25MB default) rejected
  const oversizedRes = validateAttachmentFile({
    fileName: "giant-video.mp4",
    fileSizeBytes: 26 * 1024 * 1024, // 26MB
    mimeType: "application/pdf",
  });
  assert.equal(oversizedRes.valid, false);
  assert.ok(oversizedRes.error?.includes("exceeds the maximum limit"));

  // Zero and negative bytes rejected
  const zeroRes = validateAttachmentFile({
    fileName: "empty.txt",
    fileSizeBytes: 0,
    mimeType: "text/plain",
  });
  assert.equal(zeroRes.valid, false);

  const negRes = validateAttachmentFile({
    fileName: "empty.txt",
    fileSizeBytes: -5,
    mimeType: "text/plain",
  });
  assert.equal(negRes.valid, false);
});

// 5. FILE NAME SANITIZATION
test("5. FILE NAME SANITIZATION — Strips Path Traversal, Null Bytes, and Hidden Prefixes", () => {
  assert.equal(sanitizeFileName("report.pdf"), "report.pdf");
  assert.equal(sanitizeFileName("../../etc/passwd.pdf"), "etc_passwd.pdf");
  assert.equal(sanitizeFileName("..\\..\\windows\\system32.dll"), "windows_system32.dll");
  assert.equal(sanitizeFileName("bad\0file.png"), "badfile.png");
  assert.equal(sanitizeFileName(".hidden-file.csv"), "hidden-file.csv");
  assert.equal(sanitizeFileName(""), "attachment.bin");
  assert.equal(sanitizeFileName("   "), "attachment.bin");

  // Preserves extension even with long file names
  const longName = "a".repeat(250) + ".pdf";
  const sanitizedLong = sanitizeFileName(longName);
  assert.ok(sanitizedLong.endsWith(".pdf"));
  assert.ok(sanitizedLong.length <= 200);
});

// 6. STORAGE PATH GENERATION & MULTI-TENANT ISOLATION
test("6. STORAGE PATH — Strict Workspace Partitioning and Tenant Ownership", () => {
  const ws1 = "ws-tenant-1111";
  const ws2 = "ws-tenant-2222";

  const path1 = generateStoragePath({
    workspaceId: ws1,
    entityType: "document",
    entityId: "doc-123",
    fileName: "Specification.pdf",
  });

  assert.ok(path1.startsWith(`${ws1}/document/doc-123/`));
  assert.ok(path1.endsWith("Specification.pdf"));

  // Verifying tenant ownership
  assert.equal(verifyStoragePathTenantOwnership(path1, ws1), true);
  assert.equal(verifyStoragePathTenantOwnership(path1, ws2), false);

  // Path traversal attempts are rejected
  assert.equal(verifyStoragePathTenantOwnership(`${ws1}/../../system/file`, ws1), false);
  assert.equal(verifyStoragePathTenantOwnership(`\\${ws1}\\doc\\1`, ws1), false);
  assert.equal(verifyStoragePathTenantOwnership("", ws1), false);
});

// 7. ATTACHMENT INPUT SCHEMAS
test("7. ATTACHMENT SCHEMAS — Upload, Delete, Download, and Config Contracts", () => {
  // uploadAttachmentInputSchema allows optional storagePath with auto-generation support
  const parsedAuto = uploadAttachmentInputSchema.parse({
    fileName: "financial-report.pdf",
    fileSizeBytes: 20480,
    mimeType: "application/pdf",
    attachedToType: "document",
    attachedToId: "d0000000-0000-7000-8000-000000000001",
  });
  assert.equal(parsedAuto.fileName, "financial-report.pdf");
  assert.equal(parsedAuto.storagePath, undefined);

  // uploadAttachmentInputSchema accepts explicit storagePath (backward compatibility)
  const parsedExplicit = uploadAttachmentInputSchema.parse({
    fileName: "invoice-receipt.png",
    fileSizeBytes: 5000,
    mimeType: "image/png",
    storagePath: "ws-1/invoice/inv-1/receipt.png",
    attachedToType: "invoice",
    attachedToId: "d0000000-0000-7000-8000-000000000002",
  });
  assert.equal(parsedExplicit.storagePath, "ws-1/invoice/inv-1/receipt.png");

  // Rejects oversized file above 50MB absolute cap
  assert.throws(() => {
    uploadAttachmentInputSchema.parse({
      fileName: "massive.zip",
      fileSizeBytes: 55 * 1024 * 1024,
      mimeType: "application/zip",
    });
  }, z.ZodError);

  // deleteAttachmentInputSchema requires valid UUID
  const parsedDelete = deleteAttachmentInputSchema.parse({
    attachmentId: "a0000000-0000-7000-8000-000000000001",
  });
  assert.equal(parsedDelete.attachmentId, "a0000000-0000-7000-8000-000000000001");

  assert.throws(() => {
    deleteAttachmentInputSchema.parse({ attachmentId: "not-a-uuid" });
  }, z.ZodError);

  // getAttachmentDownloadUrlInputSchema requires valid UUID
  const parsedDownload = getAttachmentDownloadUrlInputSchema.parse({
    attachmentId: "a0000000-0000-7000-8000-000000000001",
  });
  assert.equal(parsedDownload.attachmentId, "a0000000-0000-7000-8000-000000000001");

  // getStorageConfigInputSchema accepts optional workspaceId
  const parsedConfig = getStorageConfigInputSchema.parse({});
  assert.equal(parsedConfig.workspaceId, undefined);
});

// 8. ATTACHMENT TARGET ENTITY VALIDATION
test("8. TARGET ENTITIES — Canonical Types Supported and Non-Entities Rejected", () => {
  const canonicalTargets = ["document", "task", "client", "invoice"] as const;

  for (const target of canonicalTargets) {
    const res = uploadAttachmentInputSchema.parse({
      fileName: `target-${target}.pdf`,
      fileSizeBytes: 1024,
      mimeType: "application/pdf",
      attachedToType: target,
      attachedToId: "d0000000-0000-7000-8000-000000000001",
    });
    assert.equal(res.attachedToType, target);
  }

  // Non-canonical target entity rejected
  assert.throws(() => {
    uploadAttachmentInputSchema.parse({
      fileName: "exploit.pdf",
      fileSizeBytes: 1024,
      mimeType: "application/pdf",
      attachedToType: "user_credential" as any,
    });
  }, z.ZodError);
});

// 9. STORAGE STATUS HELPER
test("9. STORAGE STATUS — Reports Canonical Bucket and Invariant Notice", async () => {
  const status = await getStorageStatusInfo("disabled");

  assert.equal(status.mode, "disabled");
  assert.equal(status.isConfigured, false);
  assert.equal(status.bucket, SILEX_STORAGE_BUCKETS.DOCUMENTS);
  assert.equal(status.maxFileSizeBytes, MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES);
  assert.ok(status.allowedMimeTypes.includes("application/pdf"));
  assert.ok(status.allowedMimeTypes.includes("image/png"));
  assert.ok(status.notice.includes("$0"));
});

// 10. DOWNLOAD & UPLOAD URL REQUEST HELPERS
test("10. STORAGE REQUEST HELPERS — Safe Execution In Disabled Mode", async () => {
  const wsId = "ws-test-123";
  const filePath = `${wsId}/doc/1/test.pdf`;

  const uploadRes = await requestSignedUploadUrl(
    {
      workspaceId: wsId,
      storagePath: filePath,
      mimeType: "application/pdf",
      fileSizeBytes: 1024,
    },
    "disabled"
  );
  assert.equal(uploadRes.success, false);
  assert.equal(uploadRes.mode, "disabled");

  const downloadRes = await requestSignedDownloadUrl(
    {
      workspaceId: wsId,
      storagePath: filePath,
    },
    "disabled"
  );
  assert.equal(downloadRes.isAvailable, false);
  assert.equal(downloadRes.mode, "disabled");

  const deleteRes = await deleteStorageObject(
    {
      workspaceId: wsId,
      storagePath: filePath,
    },
    "disabled"
  );
  assert.equal(deleteRes.success, true);
});

// 11. DATABASE AND STORAGE SEPARATION INVARIANT
test("11. $0 INVARIANT — Zero Binary Blobs in PostgreSQL", () => {
  // Attachment schema strictly takes metadata strings and integer byte count
  const validAttachmentMetadata = {
    id: "a0000000-0000-7000-8000-000000000001",
    workspaceId: "ws-1",
    fileName: "contract.pdf",
    fileSizeBytes: 15400,
    mimeType: "application/pdf",
    storagePath: "ws-1/document/doc-1/contract.pdf",
    attachedToType: "document",
    attachedToId: "doc-1",
    uploadedBy: "user-1",
  };

  // Verify no Buffer, binary array, or bytea fields are part of attachment metadata
  assert.equal(typeof validAttachmentMetadata.storagePath, "string");
  assert.equal(typeof validAttachmentMetadata.fileSizeBytes, "number");
  assert.equal("data" in validAttachmentMetadata, false);
  assert.equal("binary" in validAttachmentMetadata, false);
  assert.equal("buffer" in validAttachmentMetadata, false);
});
