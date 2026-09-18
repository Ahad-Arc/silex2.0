import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseEnv } from "./config";

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
 */
export function createSupabaseServerClient(cookieAdapter?: CookieAdapter) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[SILEX Supabase] Missing required Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided.",
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        if (cookieAdapter) {
          return cookieAdapter.getAll();
        }
        return [];
      },
      setAll(cookiesToSet) {
        if (cookieAdapter?.setAll) {
          try {
            cookieAdapter.setAll(cookiesToSet);
          } catch {
            // Ignored if called from a Server Component / read-only context
          }
        }
      },
    },
  });
}
