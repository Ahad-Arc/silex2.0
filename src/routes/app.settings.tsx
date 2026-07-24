import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { User, Building2, Bell, Lock, CreditCard, Sparkles, Palette, KeyRound, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — SILEX" }, { name: "description", content: "Configure your workspace." }] }),
  component: Settings,
});

const SECTIONS = [
  { id: "profile", i: User, l: "Profile" },
  { id: "workspace", i: Building2, l: "Workspace" },
  { id: "branding", i: Palette, l: "Branding" },
  { id: "notifications", i: Bell, l: "Notifications" },
  { id: "billing", i: CreditCard, l: "Plan & billing" },
  { id: "security", i: Lock, l: "Security" },
  { id: "api", i: KeyRound, l: "API & webhooks" },
  { id: "ai", i: Sparkles, l: "SILEX AI" },
];

function Settings() {
  const [active, setActive] = useState("workspace");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-display tracking-tight">Settings</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">Fine-tune every corner of SILEX.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition",
                active === s.id ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <s.i className="h-4 w-4" /> {s.l}
              <ChevronRight className={cn("ml-auto h-3.5 w-3.5 transition", active === s.id ? "opacity-100 text-violet" : "opacity-0")} />
            </button>
          ))}
        </aside>

        <div className="space-y-4">
          <Section title="Workspace" desc="How your workspace appears to teammates and clients.">
            <Field label="Workspace name" defaultValue="Ariana Studio" />
            <Field label="Workspace URL" prefix="silex.app/" defaultValue="ariana" />
            <Field label="Support email" defaultValue="hello@ariana.studio" />
            <ToggleRow label="Public profile page" desc="Allow prospects to view your studio page." on />
            <ToggleRow label="Show 'Powered by SILEX' badge" desc="Enable on invoices and payment pages." />
          </Section>

          <Section title="Branding" desc="Make invoices and pages feel like you.">
            <div className="grid gap-3 md:grid-cols-2">
              <ColorField label="Primary color" value="#1E1B4B" />
              <ColorField label="Accent color" value="#7C3AED" />
            </div>
            <Field label="Logo" defaultValue="ariana-logo.svg" />
          </Section>

          <Section title="SILEX AI" desc="Tune how much (or how little) SILEX should do on your behalf.">
            <ToggleRow label="Auto-draft follow-up emails" desc="For overdue invoices, drafts appear in your outbox." on />
            <ToggleRow label="Weekly summary email" desc="Sunday evenings, 6pm local." on />
            <ToggleRow label="Proactive insights" desc="AI surfaces risks and opportunities on your dashboard." on />
            <ToggleRow label="AI tone" desc="Currently: Warm, professional, brief." />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
      <div className="border-b border-border/60 pb-4">
        <div className="text-lg font-display">{title}</div>
        <div className="text-[12.5px] text-muted-foreground">{desc}</div>
      </div>
      <div className="pt-5 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, defaultValue, prefix }: { label: string; defaultValue?: string; prefix?: string }) {
  return (
    <div className="grid md:grid-cols-[200px_1fr] items-center gap-3">
      <div className="text-[12.5px] font-medium">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
        {prefix && <span className="text-[13px] text-muted-foreground">{prefix}</span>}
        <input defaultValue={defaultValue} className="flex-1 bg-transparent outline-none text-[13px] min-w-0" />
      </div>
    </div>
  );
}

function ColorField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12.5px] font-medium">{label}</div>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <span className="h-5 w-5 rounded-md" style={{ background: value }} />
        <input defaultValue={value} className="flex-1 bg-transparent outline-none text-[13px] font-mono min-w-0" />
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, on: initial }: { label: string; desc: string; on?: boolean }) {
  const [on, setOn] = useState(!!initial);
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[12px] text-muted-foreground">{desc}</div>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={cn(
          "relative shrink-0 h-6 w-11 rounded-full transition",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          on && "translate-x-5",
        )} />
      </button>
    </div>
  );
}
