import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const supabase = getSupabaseBrowserClient();
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const nextRedirect = urlParams.get("redirect") || "/app";

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[SILEX Auth Callback Error]", error);
            setErrorMsg(error.message);
            return;
          }
        }

        // Verify session state
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: nextRedirect as any, replace: true });
        } else {
          navigate({ to: "/auth", replace: true });
        }
      } catch (err) {
        console.error("[SILEX Auth Callback Exception]", err);
        setErrorMsg(err instanceof Error ? err.message : "Authentication failed");
      }
    }

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center stagger">
        {errorMsg ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
            <h2 className="text-lg font-semibold">Authentication Failed</h2>
            <p className="mt-2 text-sm opacity-90">{errorMsg}</p>
            <button
              onClick={() => navigate({ to: "/auth", replace: true })}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              Return to Sign in
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Completing authentication…</p>
          </div>
        )}
      </div>
    </div>
  );
}
