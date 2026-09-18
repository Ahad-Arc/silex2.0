import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./config";

let browserClient: SupabaseClient | null = null;

/**
 * Creates or retrieves the singleton Supabase browser client.
 * Safe for client-side React components and hydration.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[SILEX Supabase] Missing required Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided.",
    );
  }

  if (typeof window === "undefined") {
    // If called on SSR context without window, initialize ephemeral client
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseBrowserClient();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});
