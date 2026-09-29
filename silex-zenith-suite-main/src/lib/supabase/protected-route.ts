import { redirect } from "@tanstack/react-router";
import { getSupabaseBrowserClient } from "./client";

/**
 * Route guard helper for TanStack Router routes.
 * Ensures the user has an active session before accessing protected SILEX application routes.
 */
export async function requireAuthGuard({ location }: { location: { href: string } }) {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw redirect({
      to: "/auth",
      search: {
        redirect: location.href,
      },
    });
  }

  return session;
}

/**
 * Sanitizes and validates a redirect target to prevent:
 * 1. Open redirects to arbitrary external origins (e.g. `https://evil.com` or `//evil.com`)
 * 2. Infinite redirect loops (e.g. `/auth`, `/auth/callback` when authenticated)
 * 3. Protocol smuggling or path traversal tricks (`/\`, `\`, control chars)
 *
 * Preserves safe relative paths with query parameters and hash fragments (e.g. `/app/projects?view=board#section`).
 */
export function sanitizeRedirectPath(
  rawPath: string | null | undefined,
  fallback = "/app",
): string {
  if (!rawPath || typeof rawPath !== "string") {
    return fallback;
  }

  const trimmed = rawPath.trim();
  if (!trimmed) {
    return fallback;
  }

  // Reject CR, LF, tabs, null bytes to prevent header/path injection
  if (/[\r\n\t\0]/.test(trimmed)) {
    return fallback;
  }

  // Reject backslashes or protocol-relative slashes to prevent open-redirect bypasses
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return fallback;
  }

  let targetPath = trimmed;

  // If rawPath is a full absolute URL, parse it safely and enforce origin matching
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      // In the browser, verify origin matches window.location
      if (typeof window !== "undefined" && window.location?.origin) {
        if (parsed.origin !== window.location.origin) {
          return fallback;
        }
        targetPath = parsed.pathname + parsed.search + parsed.hash;
      } else {
        // Outside of browser with location, reject external absolute URLs
        return fallback;
      }
    } catch {
      return fallback;
    }
  }

  // Target path must start with a single slash
  if (!targetPath.startsWith("/")) {
    return fallback;
  }

  // Check again for protocol-relative or backslash combinations after URL extraction
  if (targetPath.startsWith("//") || targetPath.startsWith("/\\") || targetPath.startsWith("\\")) {
    return fallback;
  }

  // Prevent infinite redirect loops: never redirect back to /auth or /auth/*
  const cleanPath = targetPath.split("?")[0].split("#")[0].toLowerCase();
  if (cleanPath === "/auth" || cleanPath.startsWith("/auth/")) {
    return fallback;
  }

  return targetPath;
}
