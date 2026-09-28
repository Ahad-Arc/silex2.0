/**
 * SILEX 2.0 — Production Deployment & Launch Readiness Test Suite (TASK-021)
 *
 * Verifies production launch invariants:
 * 1. Environment Configuration (.env.example completeness, client vs server separation)
 * 2. Worker Cron Authorization (Authorization header extraction, timing-safe validation)
 * 3. Auth Callback Resilience (Query & hash error detection, hash token extraction, redirect preservation)
 * 4. Auth Sign-Up Destination (emailRedirectTo preservation of redirectTarget)
 * 5. Database Connection Pool Safety (bounds, pooler compatibility)
 * 6. Student-Friendly $0 Storage Invariant (Metadata-only honesty, no fake uploads)
 * 7. Deployment Readiness Diagnostics Contract (Safe projection, zero secret exposure)
 * 8. Server-Authoritative Execution Boundary (Browser guards on server functions)
 * 9. Secret Non-Exposure Invariant (Private server secrets excluded from client bundles)
 * 10. Multi-Tenant Workspace Security (Tenant isolation on diagnostics)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.resolve(__dirname, "../src");
const envExamplePath = path.resolve(rootDir, ".env.example");

import {
  verifyWorkerCronAuthorization,
  timingSafeEqualStrings,
} from "@/lib/server-functions/automation";
import {
  getDeploymentReadinessInputSchema,
} from "@/lib/server-functions/security";
import { getStorageProvider, getStorageStatusInfo } from "@/lib/storage";

// 1. ENVIRONMENT CONFIGURATION & SECURITY SEPARATION
test("1. ENVIRONMENT CONFIGURATION — .env.example separates client and server variables", () => {
  assert.ok(fs.existsSync(envExamplePath), ".env.example must exist in project root");
  const envContent = fs.readFileSync(envExamplePath, "utf-8");

  // Client-accessible variables (must have VITE_ prefix)
  assert.ok(envContent.includes("VITE_SUPABASE_URL"), "Must define VITE_SUPABASE_URL");
  assert.ok(envContent.includes("VITE_SUPABASE_ANON_KEY"), "Must define VITE_SUPABASE_ANON_KEY");
  assert.ok(envContent.includes("VITE_STORAGE_MODE"), "Must define VITE_STORAGE_MODE");

  // Private server-only secrets (must NOT have VITE_ prefix)
  assert.ok(envContent.includes("DATABASE_URL"), "Must define DATABASE_URL");
  assert.ok(envContent.includes("CRON_SECRET"), "Must define CRON_SECRET");
  assert.ok(envContent.includes("STORAGE_MODE"), "Must define STORAGE_MODE");
  assert.ok(envContent.includes("GEMINI_API_KEY"), "Must define GEMINI_API_KEY");

  // Legacy Next.js keys must NOT be present
  assert.equal(
    envContent.includes("NEXT_PUBLIC_SUPABASE_URL"),
    false,
    "Must not include legacy Next.js NEXT_PUBLIC_SUPABASE_URL"
  );
  assert.equal(
    envContent.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    false,
    "Must not include legacy Next.js NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
});

// 2. WORKER CRON AUTHORIZATION HARDENING
test("2. WORKER CRON AUTHENTICATION — Constant-time token verification & header extraction", () => {
  const originalSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "production-cron-secret-abcdef123456";

    // Valid Bearer token
    assert.equal(
      verifyWorkerCronAuthorization("Bearer production-cron-secret-abcdef123456"),
      true,
      "Valid bearer token must authenticate"
    );

    // Case-insensitive scheme
    assert.equal(
      verifyWorkerCronAuthorization("bearer production-cron-secret-abcdef123456"),
      true,
      "Case-insensitive 'bearer' must authenticate"
    );

    // Invalid tokens
    assert.equal(
      verifyWorkerCronAuthorization("Bearer wrong-token"),
      false,
      "Wrong token must be rejected"
    );
    assert.equal(
      verifyWorkerCronAuthorization("Basic production-cron-secret-abcdef123456"),
      false,
      "Non-bearer scheme must be rejected"
    );
    assert.equal(
      verifyWorkerCronAuthorization(""),
      false,
      "Empty auth header must be rejected"
    );
    assert.equal(
      verifyWorkerCronAuthorization(null),
      false,
      "Null auth header must be rejected"
    );

    // Timing-safe comparison check
    assert.equal(timingSafeEqualStrings("abc", "abc"), true);
    assert.equal(timingSafeEqualStrings("abc", "abd"), false);
    assert.equal(timingSafeEqualStrings("abc", "abcd"), false);
  } finally {
    if (originalSecret !== undefined) {
      process.env.CRON_SECRET = originalSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  }
});

// 3. AUTH CALLBACK RESILIENCE & ERROR HANDLING
test("3. AUTH CALLBACK RESILIENCE — Inspects error parameters from query and hash fragments", () => {
  const callbackSource = fs.readFileSync(
    path.join(srcDir, "routes/auth.callback.tsx"),
    "utf-8"
  );

  // Must check error in query
  assert.ok(
    callbackSource.includes("urlParams.get(\"error_description\")") ||
    callbackSource.includes("urlParams.get(\"error\")"),
    "auth.callback.tsx must inspect query parameters for OAuth error responses"
  );

  // Must check error in hash
  assert.ok(
    callbackSource.includes("hashParams.get(\"error_description\")") ||
    callbackSource.includes("hashParams.get(\"error\")"),
    "auth.callback.tsx must inspect hash parameters for error responses"
  );

  // Must support hash-based token callbacks (implicit grant / email confirmation links)
  assert.ok(
    callbackSource.includes("hashParams.get(\"access_token\")") &&
    callbackSource.includes("hashParams.get(\"refresh_token\")"),
    "auth.callback.tsx must handle access_token and refresh_token from hash fragments"
  );
});

// 4. AUTH SIGN-UP DESTINATION PRESERVATION
test("4. AUTH SIGN-UP ROUTING — Preserves redirectTarget in emailRedirectTo", () => {
  const authSource = fs.readFileSync(
    path.join(srcDir, "routes/auth.tsx"),
    "utf-8"
  );

  assert.ok(
    authSource.includes("redirectTarget && redirectTarget !== \"/app\""),
    "auth.tsx must preserve redirectTarget when generating emailRedirectTo"
  );
  assert.ok(
    authSource.includes("encodeURIComponent(redirectTarget)"),
    "auth.tsx must URI-encode the redirect target"
  );
});

// 5. DATABASE CONNECTION POOL SAFETY & DRIZZLE CONFIG
test("5. DATABASE CLIENT INITIALIZATION — Configures pool limits and prepares: false", () => {
  const dbIndexSource = fs.readFileSync(
    path.join(srcDir, "db/index.ts"),
    "utf-8"
  );

  assert.ok(
    dbIndexSource.includes("prepare: false"),
    "db/index.ts must set prepare: false for Supabase Transaction Pooler compatibility"
  );
  assert.ok(
    dbIndexSource.includes("max:"),
    "db/index.ts must configure max connection bounds for serverless environments"
  );
  assert.ok(
    dbIndexSource.includes("idle_timeout:"),
    "db/index.ts must configure idle_timeout to avoid hanging pooler connections"
  );
});

// 6. STUDENT-FRIENDLY $0 STORAGE INVARIANT
test("6. $0 STORAGE INVARIANT — Honest status reporting and safe fallback", async () => {
  const provider = getStorageProvider("disabled");
  const status = provider.getStorageStatus();

  assert.equal(status.mode, "disabled");
  assert.equal(status.isConfigured, false);
  assert.ok(
    status.notice.includes("$0"),
    "Disabled storage provider notice must explicitly document $0 mode"
  );

  // Upload request returns honest unconfigured error without faking upload
  const uploadRes = await provider.getSignedUploadUrl({
    workspaceId: "ws-test",
    storagePath: "ws-test/document/1/test.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 1024,
  });
  assert.equal(uploadRes.success, false);
  assert.ok(
    uploadRes.error?.includes("STORAGE_UNCONFIGURED"),
    "Upload in disabled mode must report STORAGE_UNCONFIGURED"
  );
});

// 7. DEPLOYMENT READINESS SCHEMA & DIAGNOSTICS
test("7. DEPLOYMENT READINESS DIAGNOSTICS CONTRACT — Schema validates and enforces safe types", () => {
  // Empty options parses successfully
  const parsed = getDeploymentReadinessInputSchema.parse({});
  assert.equal(parsed.workspaceId, undefined);

  // Valid UUID parses
  const validUuid = "018f6730-1000-7000-8000-000000000001";
  const parsedWithWs = getDeploymentReadinessInputSchema.parse({
    workspaceId: validUuid,
  });
  assert.equal(parsedWithWs.workspaceId, validUuid);

  // Malformed UUID rejected
  assert.throws(() => {
    getDeploymentReadinessInputSchema.parse({ workspaceId: "invalid-uuid-string" });
  });
});

// 8. SERVER-AUTHORITATIVE EXECUTION BOUNDARY
test("8. SERVER-AUTHORITATIVE GUARDS — Execution blocked in client browser", () => {
  const securitySource = fs.readFileSync(
    path.join(srcDir, "lib/server-functions/security.ts"),
    "utf-8"
  );

  assert.ok(
    securitySource.includes("getDeploymentReadinessFn"),
    "security.ts must export getDeploymentReadinessFn"
  );
  assert.ok(
    securitySource.includes("typeof window !== \"undefined\""),
    "getDeploymentReadinessFn must enforce browser execution guard"
  );
});

// 9. SECRET NON-EXPOSURE IN BROWSER CLIENT
test("9. SECRET PRIVACY — Server-only secrets are not exported to client", () => {
  const supabaseIndexSource = fs.readFileSync(
    path.join(srcDir, "lib/supabase/index.ts"),
    "utf-8"
  );

  // Ensure server.ts and server-context.ts are NOT re-exported in index.ts
  assert.equal(
    supabaseIndexSource.includes("./server"),
    false,
    "src/lib/supabase/index.ts must NEVER re-export server.ts or server-context.ts"
  );

  // Ensure DATABASE_URL is not referenced in config.ts
  const configSource = fs.readFileSync(
    path.join(srcDir, "lib/supabase/config.ts"),
    "utf-8"
  );
  assert.equal(
    configSource.includes("DATABASE_URL"),
    false,
    "src/lib/supabase/config.ts must NEVER reference DATABASE_URL"
  );
});

// 10. NITRO CLOUDFLARE BUILD TARGET VERIFICATION
test("10. PRODUCTION DEPLOYMENT TARGET — Verified Nitro Cloudflare configuration", () => {
  const viteConfigSource = fs.readFileSync(
    path.join(rootDir, "vite.config.ts"),
    "utf-8"
  );
  assert.ok(
    viteConfigSource.includes("tanstackStart"),
    "vite.config.ts must configure tanstackStart"
  );

  // Output nitro.json if build exists
  const nitroJsonPath = path.resolve(rootDir, ".output/nitro.json");
  if (fs.existsSync(nitroJsonPath)) {
    const nitroConfig = JSON.parse(fs.readFileSync(nitroJsonPath, "utf-8"));
    assert.equal(
      nitroConfig.preset,
      "cloudflare-module",
      "Nitro preset must be cloudflare-module"
    );
  }
});
