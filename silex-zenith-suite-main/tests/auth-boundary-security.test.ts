/**
 * SILEX 2.0 — Authentication Boundary & Security Hardening Test Suite
 *
 * Verifies critical authentication invariants:
 * 1. Unauthenticated users cannot access protected routes (requireAuthGuard redirects to /auth)
 * 2. localStorage cannot establish authentication (silex_demo_session is ignored/rejected)
 * 3. Invalid/failed Supabase authentication does not create an authenticated user (throws AuthContextError)
 * 4. Hardcoded demo-user fallback (018f6730-1000-7000-8000-000000000001) no longer exists anywhere in source code
 * 5. Environment variables are authoritative in config.ts with zero hardcoded fallbacks
 * 6. Legitimate Supabase authentication contract is preserved
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");
const srcDir = path.resolve(__dirname, "../src");

// Load .env if present in development/test environment
if (process.loadEnvFile && fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

import { getSupabaseEnv } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthContextError, getServerAuthContext } from "@/lib/supabase/server-context";
import { requireAuthGuard, sanitizeRedirectPath } from "@/lib/supabase/protected-route";

test("1. UNAUTHENTICATED ROUTE ACCESS — Protected route guard redirects to /auth", async () => {
  // In Node/server test environment without active session, requireAuthGuard must redirect
  const mockLocation = { href: "https://silex.app/app/invoices" };

  await assert.rejects(
    async () => {
      await requireAuthGuard({ location: mockLocation });
    },
    (err: any) => {
      // TanStack redirect throws a Response with options { to: '/auth', search: { redirect: ... } }
      assert.ok(err, "Must throw redirect error/response");
      const redirectOptions = err.options;
      assert.ok(redirectOptions, "Must contain TanStack redirect options");
      assert.equal(redirectOptions.to, "/auth", "Must redirect unauthenticated request to /auth");
      assert.equal(
        redirectOptions.search?.redirect,
        "https://silex.app/app/invoices",
        "Must preserve target redirect location",
      );
      return true;
    },
  );
});

test("2. LOCALSTORAGE AUTH BYPASS INVALIDATION — localStorage cannot establish authentication", async () => {
  // Verify that protected-route.ts has zero references to localStorage or silex_demo_session
  const protectedRouteSource = fs.readFileSync(
    path.join(srcDir, "lib/supabase/protected-route.ts"),
    "utf-8",
  );
  assert.equal(
    protectedRouteSource.includes("silex_demo_session"),
    false,
    "protected-route.ts must NEVER check silex_demo_session",
  );
  assert.equal(
    protectedRouteSource.includes("localStorage"),
    false,
    "protected-route.ts must NEVER read localStorage to grant access",
  );

  // Verify AuthProvider.tsx has zero references to silex_demo_session
  const authProviderSource = fs.readFileSync(
    path.join(srcDir, "lib/supabase/AuthProvider.tsx"),
    "utf-8",
  );
  assert.equal(
    authProviderSource.includes("silex_demo_session"),
    false,
    "AuthProvider.tsx must NEVER read or write silex_demo_session",
  );
  assert.equal(
    authProviderSource.includes("silex_auth_change"),
    false,
    "AuthProvider.tsx must NEVER dispatch or listen to custom silex_auth_change event",
  );

  // Verify auth.tsx has zero references to silex_demo_session
  const authRouteSource = fs.readFileSync(
    path.join(srcDir, "routes/auth.tsx"),
    "utf-8",
  );
  assert.equal(
    authRouteSource.includes("silex_demo_session"),
    false,
    "auth.tsx must NEVER write silex_demo_session to localStorage",
  );
});

test("3. SERVER AUTH CONTEXT FAILURE — Failed auth throws AuthContextError without user fabrication", async () => {
  // getServerAuthContext with no session/cookie must throw AuthContextError("UNAUTHENTICATED")
  await assert.rejects(
    async () => {
      await getServerAuthContext();
    },
    (err: any) => {
      assert.ok(err instanceof AuthContextError, "Error must be instance of AuthContextError");
      assert.equal(err.code, "UNAUTHENTICATED", "Error code must be UNAUTHENTICATED");
      assert.match(
        err.message,
        /Authentication required|No active session/i,
        "Error message must indicate missing/failed authentication",
      );
      return true;
    },
  );
});

test("4. DEMO USER INVARIANT — Hardcoded demo user UUID and fabrication completely removed", async () => {
  const demoUserId = "018f6730-1000-7000-8000-000000000001";

  // Check server-context.ts
  const serverContextSource = fs.readFileSync(
    path.join(srcDir, "lib/supabase/server-context.ts"),
    "utf-8",
  );
  assert.equal(
    serverContextSource.includes(demoUserId),
    false,
    "server-context.ts must NOT contain demo user ID",
  );
  assert.equal(
    serverContextSource.includes("demoUserId"),
    false,
    "server-context.ts must NOT contain demoUserId variable",
  );
  assert.equal(
    serverContextSource.includes("admin@silex.app"),
    false,
    "server-context.ts must NOT contain hardcoded admin@silex.app fallback",
  );

  // Check auth.tsx
  const authRouteSource = fs.readFileSync(
    path.join(srcDir, "routes/auth.tsx"),
    "utf-8",
  );
  assert.equal(
    authRouteSource.includes(demoUserId),
    false,
    "auth.tsx must NOT contain demo user ID",
  );
  assert.equal(
    authRouteSource.includes("handleDemoLogin"),
    false,
    "auth.tsx must NOT contain handleDemoLogin function",
  );
  assert.equal(
    authRouteSource.includes("Demo Credentials"),
    false,
    "auth.tsx must NOT contain Demo Credentials UI banner",
  );

  // Recursively inspect all files in src/ to guarantee zero occurrences
  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        assert.equal(
          content.includes(demoUserId),
          false,
          `File ${fullPath} must NOT contain demoUserId ${demoUserId}`,
        );
        assert.equal(
          content.includes("silex_demo_session"),
          false,
          `File ${fullPath} must NOT contain silex_demo_session`,
        );
      }
    }
  }
  scanDir(srcDir);
});

test("5. SUPABASE CONFIGURATION INVARIANT — Strictly environment-variable driven with zero hardcoded fallbacks", async () => {
  const configSource = fs.readFileSync(
    path.join(srcDir, "lib/supabase/config.ts"),
    "utf-8",
  );

  // Verify no hardcoded remote URL fallback exists in source code
  assert.equal(
    configSource.includes("https://pohsooqlnraodafcrrhj.supabase.co"),
    false,
    "config.ts must NOT contain hardcoded fallback Supabase URL",
  );

  // Verify no hardcoded JWT anon token fallback exists in source code
  assert.equal(
    configSource.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"),
    false,
    "config.ts must NOT contain hardcoded fallback Supabase anon JWT key",
  );

  // Save current env
  const originalUrl = process.env.VITE_SUPABASE_URL;
  const originalAnon = process.env.VITE_SUPABASE_ANON_KEY;
  const originalNextUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalNextAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalSupUrl = process.env.SUPABASE_URL;
  const originalSupAnon = process.env.SUPABASE_ANON_KEY;

  try {
    // Clear all Supabase env vars
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    const envResult = getSupabaseEnv();
    assert.equal(
      envResult.supabaseUrl,
      "",
      "Without environment variables, supabaseUrl must be empty string (no silent fallback)",
    );
    assert.equal(
      envResult.supabaseAnonKey,
      "",
      "Without environment variables, supabaseAnonKey must be empty string (no silent fallback)",
    );

    // Verify server and browser clients throw explicit error when env vars are missing
    assert.throws(() => {
      createSupabaseServerClient();
    }, /Missing required Supabase environment variables/);

    assert.throws(() => {
      getSupabaseBrowserClient();
    }, /Missing required Supabase environment variables/);
  } finally {
    // Restore env vars
    if (originalUrl !== undefined) process.env.VITE_SUPABASE_URL = originalUrl;
    if (originalAnon !== undefined) process.env.VITE_SUPABASE_ANON_KEY = originalAnon;
    if (originalNextUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = originalNextUrl;
    if (originalNextAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalNextAnon;
    if (originalSupUrl !== undefined) process.env.SUPABASE_URL = originalSupUrl;
    if (originalSupAnon !== undefined) process.env.SUPABASE_ANON_KEY = originalSupAnon;
  }
});

test("6. LEGITIMATE AUTHENTICATION FLOWS PRESERVED", async () => {
  // When environment variables are provided, getSupabaseEnv correctly extracts them
  const env = getSupabaseEnv();
  assert.ok(env.supabaseUrl.length > 0, "Supabase URL should be configured from test environment");
  assert.ok(env.supabaseAnonKey.length > 0, "Supabase Anon Key should be configured from test environment");

  // Verify AuthContextError contract
  const customError = new AuthContextError("USER_NOT_PROVISIONED", "User record missing in public.users");
  assert.equal(customError.code, "USER_NOT_PROVISIONED");
  assert.equal(customError.name, "AuthContextError");
});

test("7. OAUTH REDIRECT TARGET PRESERVATION — Preserves destination in callback URL", () => {
  const authSource = fs.readFileSync(
    path.join(srcDir, "routes/auth.tsx"),
    "utf-8",
  );

  // Verifies that auth.tsx appends redirect parameter to callback URL
  assert.ok(
    authSource.includes("encodeURIComponent(redirectTarget)"),
    "auth.tsx must encode and append redirectTarget to OAuth callback URL",
  );

  const callbackSource = fs.readFileSync(
    path.join(srcDir, "routes/auth.callback.tsx"),
    "utf-8",
  );

  // Verifies that callback route reads redirect parameter
  assert.ok(
    callbackSource.includes("urlParams.get(\"redirect\")"),
    "auth.callback.tsx must read the redirect URL parameter for post-auth routing",
  );
});

test("8. LOGOUT LIFECYCLE & ROUTE TEARDOWN — Explicit sign-out transitions to /auth", () => {
  const appShellSource = fs.readFileSync(
    path.join(srcDir, "components/silex/app-shell.tsx"),
    "utf-8",
  );

  // AppShell must await signOut and navigate to /auth with replace
  assert.ok(
    appShellSource.includes("await signOut()"),
    "AppShell must await signOut() upon user click",
  );
  assert.ok(
    appShellSource.includes("navigate({ to: \"/auth\", replace: true })"),
    "AppShell must explicitly navigate to /auth after sign-out",
  );

  const authProviderSource = fs.readFileSync(
    path.join(srcDir, "lib/supabase/AuthProvider.tsx"),
    "utf-8",
  );

  // AuthProvider must clear both user and session in finally block
  assert.ok(
    authProviderSource.includes("setUser(null)"),
    "AuthProvider signOut must clear user state",
  );
  assert.ok(
    authProviderSource.includes("setSession(null)"),
    "AuthProvider signOut must clear session state",
  );
});

test("9. SERVER-SIDE AUTHORIZATION SECURITY BOUNDARY — Client execution blocked", async () => {
  const serverContextSource = fs.readFileSync(
    path.join(srcDir, "lib/supabase/server-context.ts"),
    "utf-8",
  );
  assert.ok(
    serverContextSource.includes("typeof window !== \"undefined\""),
    "getServerAuthContext must contain browser execution guard",
  );

  const workspaceAuthSource = fs.readFileSync(
    path.join(srcDir, "lib/auth/workspace.ts"),
    "utf-8",
  );
  assert.ok(
    workspaceAuthSource.includes("typeof window !== \"undefined\""),
    "requireWorkspaceAccess must contain browser execution guard",
  );
});

test("10. REDIRECT SANITIZATION & LOOP PREVENTION — Protects against open redirects and redirect loops", () => {
  // 1. Preserves safe relative routes with query parameters and hash fragments
  assert.equal(
    sanitizeRedirectPath("/app/projects?view=board#sprint-1"),
    "/app/projects?view=board#sprint-1",
    "Must preserve safe relative paths with query parameters and hash",
  );

  // 2. Safe fallbacks for missing or empty inputs
  assert.equal(sanitizeRedirectPath(null), "/app");
  assert.equal(sanitizeRedirectPath(undefined), "/app");
  assert.equal(sanitizeRedirectPath(""), "/app");
  assert.equal(sanitizeRedirectPath("   "), "/app");

  // 3. Infinite redirect loop prevention: blocks /auth and sub-paths
  assert.equal(sanitizeRedirectPath("/auth"), "/app", "Must prevent looping back to /auth");
  assert.equal(sanitizeRedirectPath("/auth/callback"), "/app", "Must prevent looping to /auth/callback");
  assert.equal(sanitizeRedirectPath("/auth?redirect=/app"), "/app", "Must prevent looping to /auth with query");

  // 4. Open redirect prevention: blocks external origins and protocol tricks
  assert.equal(sanitizeRedirectPath("https://evil.com/phish"), "/app", "Must reject external absolute URLs");
  assert.equal(sanitizeRedirectPath("http://attacker.org"), "/app", "Must reject external http URLs");
  assert.equal(sanitizeRedirectPath("//evil.com"), "/app", "Must reject protocol-relative URLs");
  assert.equal(sanitizeRedirectPath("/\\evil.com"), "/app", "Must reject backslash bypass attempts");
  assert.equal(sanitizeRedirectPath("\\evil.com"), "/app", "Must reject leading backslash attempts");
  assert.equal(sanitizeRedirectPath("javascript:alert(1)"), "/app", "Must reject javascript: pseudo-protocol");

  // 5. Control character injection defense
  assert.equal(sanitizeRedirectPath("/app\r\nSet-Cookie:admin=1"), "/app", "Must reject CRLF control characters");

  // 6. Source-level verification: auth.tsx and auth.callback.tsx both call sanitizeRedirectPath
  const authSource = fs.readFileSync(path.join(srcDir, "routes/auth.tsx"), "utf-8");
  assert.ok(
    authSource.includes("sanitizeRedirectPath(rawTarget"),
    "auth.tsx must sanitize redirect target",
  );

  const callbackSource = fs.readFileSync(path.join(srcDir, "routes/auth.callback.tsx"), "utf-8");
  assert.ok(
    callbackSource.includes("sanitizeRedirectPath(rawRedirect"),
    "auth.callback.tsx must sanitize redirect target",
  );
});
