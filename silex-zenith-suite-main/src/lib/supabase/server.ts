import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCookies, setCookie, getRequestHeader } from "@tanstack/react-start/server";
import { getSupabaseEnv } from "./config";

if (typeof globalThis !== "undefined") {
  (globalThis as unknown as { __silex_getRequestHeader?: unknown }).__silex_getRequestHeader = getRequestHeader;
}

export interface CookieAdapter {
  getAll: () => Array<{ name: string; value: string }>;
  setAll?: (
    cookiesToSet: Array<{
      name: string;
      value: string;
      options: CookieOptions;
    }>,
  ) => void;
}

/**
 * Creates a server-side Supabase client for SSR & server functions.
 * Uses @supabase/ssr with custom or standard cookie adapters.
 * Connects automatically to TanStack Start server runtime request cookies.
 */
export function createSupabaseServerClient(cookieAdapter?: CookieAdapter) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[SILEX Supabase] Missing required Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided.",
    );
  }

  // Check if an incoming Authorization header was provided
  let authHeader: string | undefined;
  try {
    const raw = getRequestHeader("authorization");
    if (raw) authHeader = raw;
  } catch {
    // Outside of active Start server request context
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    cookies: {
      getAll() {
        if (cookieAdapter) {
          return cookieAdapter.getAll();
        }
        const ambient = (globalThis as unknown as { __silex_cookie_adapter?: CookieAdapter })
          ?.__silex_cookie_adapter;
        if (ambient) {
          return ambient.getAll();
        }
        try {
          const cookies = getCookies();
          if (cookies) {
            return Object.entries(cookies).map(([name, value]) => ({
              name,
              value: value ?? "",
            }));
          }
        } catch {
          // Outside of active Start server request context (e.g. CLI, tests, build)
        }
        return [];
      },
      setAll(cookiesToSet) {
        if (cookieAdapter?.setAll) {
          try {
            cookieAdapter.setAll(cookiesToSet);
          } catch {
            // Ignored if called from a read-only context
          }
          return;
        }
        const ambient = (globalThis as unknown as { __silex_cookie_adapter?: CookieAdapter })
          ?.__silex_cookie_adapter;
        if (ambient?.setAll) {
          try {
            ambient.setAll(cookiesToSet);
          } catch {
            // Ignored
          }
          return;
        }
        try {
          for (const { name, value, options } of cookiesToSet) {
            setCookie(name, value, options);
          }
        } catch {
          // Outside of active Start server request context
        }
      },
    },
  });
}
