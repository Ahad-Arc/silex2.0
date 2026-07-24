import { createFileRoute } from "@tanstack/react-router";
import { Bell, Check, DollarSign, Users, FileText, Sparkles, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — SILEX" }, { name: "description", content: "Everything that changed." }] }),
  component: Notifications,
});

const GROUPS: { title: string; items: { i: React.ComponentType<{ className?: string }>; t: string; d: string; w: string; unread?: boolean; tone?: string }[] }[] = [
  {
    title: "Today",
    items: [
      { i: DollarSign, t: "Payment received", d: "Acme Studio · $12,400 · Card", w: "2h ago", unread: true, tone: "success" },
      { i: Sparkles, t: "SILEX AI drafted a follow-up", d: "For INV-2039 — Nova Labs", w: "4h ago", unread: true, tone: "violet" },
      { i: FileText, t: "Invoice viewed", d: "Nova Labs opened INV-2041 twice", w: "5h ago", unread: true },
    ],
  },
  {
    title: "Yesterday",
    items: [
      { i: AlertTriangle, t: "Invoice overdue", d: "INV-2039 · Nova Labs · 6 days overdue", w: "1d ago", tone: "destructive" },
      { i: Users, t: "New client added", d: "Riverside Media joined your workspace", w: "1d ago", tone: "violet" },
    ],
  },
  {
    title: "This week",
    items: [
      { i: Check, t: "Contract signed", d: "Foundry Type — Q3 retainer", w: "3d ago", tone: "success" },
      { i: FileText, t: "Invoice sent", d: "INV-2038 · Foundry Type · $4,500", w: "3d ago" },
      { i: Bell, t: "Weekly digest ready", d: "Your week in numbers", w: "5d ago" },
    ],
  },
];

const toneRing: Record<string, string> = {
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
  violet: "bg-violet/10 text-violet",
};

function Notifications() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Notifications</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Everything that matters, nothing that doesn't.</p>
        </div>
        <button className="text-[12px] text-primary hover:underline">Mark all read</button>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-0.5 text-[12px] w-fit">
        {["All", "Unread", "Payments", "Clients", "AI"].map((t, i) => (
          <button key={t} className={`px-3 py-1.5 rounded-lg transition ${i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      <div className="space-y-8 stagger">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">{g.title}</div>
            <div className="rounded-3xl border border-border/70 bg-card/70 divide-y divide-border/60 overflow-hidden">
              {g.items.map((n, i) => (
                <div key={i} className={`flex items-start gap-3 px-5 py-4 hover:bg-muted/40 transition ${n.unread ? "bg-violet/5" : ""}`}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${n.tone ? toneRing[n.tone] : "bg-muted text-muted-foreground"}`}>
                    <n.i className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium">{n.t}</span>
                      {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-violet" />}
                    </div>
                    <div className="text-[12.5px] text-muted-foreground truncate">{n.d}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground shrink-0">{n.w}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
