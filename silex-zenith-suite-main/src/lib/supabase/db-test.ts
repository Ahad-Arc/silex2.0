import { getSupabaseBrowserClient } from "./client";
import { createSupabaseServerClient } from "./server";
import { getSupabaseEnv } from "./config";

export interface SupabaseHealthCheckResult {
  browserClientInitialized: boolean;
  serverClientInitialized: boolean;
  urlValid: boolean;
  authApiReachable: boolean;
  sessionCheckSuccess: boolean;
  serviceRoleExposed: boolean;
  details: {
    supabaseUrl: string;
    hasAnonKey: boolean;
    sessionUser: string | null;
    errorMessage?: string;
  };
}

/**
 * Safe development verification utility to confirm Supabase initialization and reachability.
 */
export async function testSupabaseConnection(): Promise<SupabaseHealthCheckResult> {
  const result: SupabaseHealthCheckResult = {
    browserClientInitialized: false,
    serverClientInitialized: false,
    urlValid: false,
    authApiReachable: false,
    sessionCheckSuccess: false,
    serviceRoleExposed: false,
    details: {
      supabaseUrl: "",
      hasAnonKey: false,
      sessionUser: null,
    },
  };

  try {
    const env = getSupabaseEnv();
    result.details.supabaseUrl = env.supabaseUrl;
    result.details.hasAnonKey = !!env.supabaseAnonKey;

    // Check URL validity
    try {
      new URL(env.supabaseUrl);
      result.urlValid = true;
    } catch {
      result.urlValid = false;
    }

    // Security check: service role key check
    const rawKey = env.supabaseAnonKey.toLowerCase();
    if (rawKey.includes("service_role") || rawKey.includes("service-role")) {
      result.serviceRoleExposed = true;
    }

    // Browser Client test
    const browserClient = getSupabaseBrowserClient();
    if (browserClient) {
      result.browserClientInitialized = true;
    }

    // Server Client test
    const serverClient = createSupabaseServerClient();
    if (serverClient) {
      result.serverClientInitialized = true;
    }

    // Reachability and Session check
    const { data, error } = await browserClient.auth.getSession();
    if (!error) {
      result.authApiReachable = true;
      result.sessionCheckSuccess = true;
      result.details.sessionUser =
        data.session?.user?.id ?? "unauthenticated (valid session check)";
    } else {
      result.details.errorMessage = error.message;
    }
  } catch (err) {
    result.details.errorMessage = err instanceof Error ? err.message : String(err);
  }

  return result;
}
