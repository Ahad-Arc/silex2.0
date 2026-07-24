import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Mail, Lock, Github, Chrome } from "lucide-react";
import { SilexLogo } from "@/components/silex/logo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — SILEX" }, { name: "description", content: "Sign in to SILEX." }] }),
  component: Auth,
});

function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: form */}
      <div className="flex flex-col p-8 lg:p-12">
        <Link to="/"><SilexLogo /></Link>
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm mx-auto stagger">
            <h1 className="text-5xl font-display tracking-tight">
              {mode === "signin" ? "Welcome back." : "Create account."}
            </h1>
            <p className="mt-3 text-[14px] text-muted-foreground">
              {mode === "signin" ? "Sign in to your SILEX workspace." : "Start your 14-day trial. No card needed."}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 py-2.5 text-[13px] font-medium hover:border-violet/50 transition">
                <Chrome className="h-4 w-4" /> Google
              </button>
              <button className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 py-2.5 text-[13px] font-medium hover:border-violet/50 transition">
                <Github className="h-4 w-4" /> GitHub
              </button>
            </div>

            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
            </div>

            <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
              <label className="block">
                <span className="text-[12px] font-medium text-muted-foreground">Email</span>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-violet/60 transition">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <input className="flex-1 bg-transparent outline-none text-[14px]" placeholder="you@company.com" />
                </div>
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-muted-foreground">Password</span>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-violet/60 transition">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <input type="password" className="flex-1 bg-transparent outline-none text-[14px]" placeholder="••••••••" />
                </div>
              </label>

              <Link
                to={mode === "signin" ? "/app" : "/onboarding"}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 text-[13px] font-medium hover:bg-primary/90 shadow-float transition"
              >
                {mode === "signin" ? "Sign in" : "Create account"} <ArrowRight className="h-4 w-4" />
              </Link>
            </form>

            <div className="mt-6 text-center text-[13px] text-muted-foreground">
              {mode === "signin" ? "New to SILEX?" : "Already have an account?"}{" "}
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="text-primary font-medium hover:underline"
              >
                {mode === "signin" ? "Create account" : "Sign in"}
              </button>
            </div>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">© 2026 SILEX Systems, Inc.</div>
      </div>

      {/* Right: editorial */}
      <div className="relative hidden lg:flex overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-mesh-dark" />
        <div className="relative m-auto p-16 max-w-lg">
          <div className="text-[11px] uppercase tracking-widest opacity-70">Trusted by 38,000+ independents</div>
          <blockquote className="mt-8 text-4xl font-display leading-tight tracking-tight text-balance">
            "SILEX feels like the calmest tool I own. It's the first business software that respects my attention."
          </blockquote>
          <div className="mt-8 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-sm font-semibold">MI</span>
            <div>
              <div className="text-[13px] font-medium">Maya Ito</div>
              <div className="text-[12px] opacity-70">Brand designer · ITO Studio</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
