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
