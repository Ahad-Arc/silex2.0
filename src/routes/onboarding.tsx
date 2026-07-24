import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, User, Briefcase, Palette, Building2, Code, PenTool, Sparkles } from "lucide-react";
import { SilexLogo } from "@/components/silex/logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — SILEX" }, { name: "description", content: "Set up your SILEX workspace." }] }),
  component: Onboarding,
});

const STEPS = ["Profile", "Business type", "Workspace", "You're in"];

function Onboarding() {
  const [step, setStep] = useState(0);
  return (
    <div className="min-h-screen bg-background bg-grain flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-border/60">
        <SilexLogo />
        <Link to="/app" className="text-[13px] text-muted-foreground hover:text-foreground">Skip for now</Link>
      </header>

      {/* Progress */}
      <div className="mx-auto w-full max-w-3xl px-6 pt-10">
        <div className="flex items-center gap-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3 flex-1 last:flex-none">
              <div className={cn(
                "grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold transition",
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-violet text-violet-foreground shadow-float" :
                "border border-border bg-card text-muted-foreground"
              )}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={cn("text-[12px] font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border ml-1" />}
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 flex items-center">
        <div className="mx-auto w-full max-w-2xl px-6 py-16 animate-rise" key={step}>
          {step === 0 && <StepProfile />}
          {step === 1 && <StepBusiness />}
          {step === 2 && <StepWorkspace />}
          {step === 3 && <StepDone />}

          <div className="mt-10 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={step === 0}
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                to="/app"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
              >
                Enter workspace <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StepProfile() {
  return (
    <div>
      <h1 className="text-4xl font-display tracking-tight">Let's set up your profile.</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">A few basics so your invoices and workspace feel like you.</p>
      <div className="mt-8 grid gap-4">
        <Field label="Full name" defaultValue="Ariana Vale" />
        <Field label="Company or brand" defaultValue="Ariana Studio" />
        <Field label="Website" defaultValue="ariana.studio" />
      </div>
    </div>
  );
}

function StepBusiness() {
  const opts = [
    { icon: PenTool, label: "Freelancer", sub: "Independent, solo" },
    { icon: Palette, label: "Creative studio", sub: "2–10 people" },
    { icon: Code, label: "Dev shop / agency", sub: "Engineering-led" },
    { icon: Building2, label: "Startup", sub: "Product company" },
    { icon: Briefcase, label: "Consultant", sub: "Advisory or fractional" },
    { icon: Sparkles, label: "Something else", sub: "Tell us more later" },
  ];
  const [pick, setPick] = useState(0);
  return (
    <div>
      <h1 className="text-4xl font-display tracking-tight">What kind of business?</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">We'll tailor invoice templates and reports.</p>
      <div className="mt-8 grid grid-cols-2 gap-3">
        {opts.map((o, i) => (
          <button
            key={o.label}
            onClick={() => setPick(i)}
            className={cn(
              "text-left rounded-2xl border p-4 transition hover-lift",
              pick === i ? "border-violet bg-violet/5" : "border-border bg-card/60 hover:border-violet/50",
            )}
          >
            <o.icon className={cn("h-5 w-5", pick === i ? "text-violet" : "text-muted-foreground")} />
            <div className="mt-3 text-[14px] font-medium">{o.label}</div>
            <div className="text-[12px] text-muted-foreground">{o.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepWorkspace() {
  return (
    <div>
      <h1 className="text-4xl font-display tracking-tight">Name your workspace.</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">You can invite teammates later.</p>
      <div className="mt-8 grid gap-4">
        <Field label="Workspace name" defaultValue="Ariana Studio" />
        <Field label="Workspace URL" prefix="silex.app/" defaultValue="ariana" />
        <div>
          <div className="text-[12px] font-medium text-muted-foreground">Currency</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {["USD", "EUR", "GBP", "CAD", "AUD"].map((c, i) => (
              <button key={c} className={cn(
                "rounded-lg border px-3 py-1.5 text-[13px] transition",
                i === 0 ? "border-violet bg-violet/5 text-violet font-medium" : "border-border bg-card/60 hover:border-violet/40"
              )}>{c}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDone() {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-violet text-primary-foreground shadow-float-lg">
        <Check className="h-6 w-6" />
      </div>
      <h1 className="mt-6 text-4xl font-display tracking-tight">You're all set.</h1>
      <p className="mt-3 max-w-md mx-auto text-[14px] text-muted-foreground">
        Your workspace is ready. Let's create your first invoice or add a client — SILEX AI can help.
      </p>
    </div>
  );
}

function Field({ label, defaultValue, prefix }: { label: string; defaultValue?: string; prefix?: string }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-violet/60 transition">
        {prefix && <span className="text-[13px] text-muted-foreground">{prefix}</span>}
        <input defaultValue={defaultValue} className="flex-1 bg-transparent outline-none text-[14px]" />
      </div>
    </label>
  );
}
