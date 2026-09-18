/**
 * SILEX 2.0 Supabase Configuration Helper
 * Safely resolves Supabase URL and Anon Key across client and server runtimes.
 */

export function getSupabaseEnv() {
  // Check Vite / import.meta.env
  let url =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_SUPABASE_URL
      : undefined;
  let anonKey =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_SUPABASE_ANON_KEY
      : undefined;

  // Fallback to process.env / NEXT_PUBLIC_ / standard Supabase variables
  if (!url && typeof process !== "undefined" && process.env) {
    url =
      process.env.VITE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL;
  }
  if (!anonKey && typeof process !== "undefined" && process.env) {
    anonKey =
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;
  }

  if (!url || !anonKey) {
    if (typeof window !== "undefined") {
      console.warn(
        "[SILEX Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment variables.",
      );
    }
  }

  return {
    supabaseUrl: url || "",
    supabaseAnonKey: anonKey || "",
  };
}
