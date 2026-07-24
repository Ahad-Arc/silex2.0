import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Filter, Plus, ArrowUpRight, ArrowDownRight, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/app/clients")({
  head: () => ({ meta: [{ title: "Clients — SILEX" }, { name: "description", content: "Every client, one page." }] }),
  component: Clients,
});

const CLIENTS = [
  { id: "acme-studio", n: "Acme Studio", contact: "Ellie Wu", email: "ellie@acme.co", rev: 42400, invoices: 8, status: "Active", tone: "success", g: 34, since: "Jan 2024" },
  { id: "nova-labs", n: "Nova Labs", contact: "Diego Santos", email: "diego@novalabs.dev", rev: 28200, invoices: 6, status: "Overdue", tone: "destructive", g: 12, since: "Mar 2024" },
  { id: "foundry-type", n: "Foundry Type", contact: "Jordan Reyes", email: "jr@foundrytype.co", rev: 18400, invoices: 4, status: "Active", tone: "success", g: -6, since: "Jun 2024" },
  { id: "riverside-media", n: "Riverside Media", contact: "Priya Shah", email: "priya@riverside.tv", rev: 12200, invoices: 3, status: "New", tone: "violet", g: 22, since: "Sep 2025" },
  { id: "kite-club", n: "Kite Club", contact: "Sam Ito", email: "sam@kite.club", rev: 8600, invoices: 2, status: "Active", tone: "success", g: 4, since: "Apr 2025" },
  { id: "orbit-house", n: "Orbit House", contact: "Ren Park", email: "ren@orbit.house", rev: 6200, invoices: 2, status: "Paused", tone: "muted", g: 0, since: "Feb 2025" },
];

const toneMap: Record<string, string> = {
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
  violet: "bg-violet/10 text-violet",
  muted: "bg-muted text-muted-foreground",
};

function Clients() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Clients</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Every relationship, in one place.</p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition">
          <Plus className="h-3.5 w-3.5" /> Add client
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Active", v: "24", d: "clients" },
          { l: "Lifetime revenue", v: "$284k", d: "+18% YoY" },
          { l: "Avg. deal size", v: "$4.2k", d: "per invoice" },
          { l: "Retention", v: "94%", d: "12mo rolling" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border/70 bg-card/70 p-5 hover-lift">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
            <div className="mt-2 text-3xl font-display">{s.v}</div>
            <div className="text-[12px] text-muted-foreground">{s.d}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 flex-1 min-w-[240px] focus-within:border-violet/60 transition">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Search clients, emails, projects..." className="flex-1 bg-transparent outline-none text-[13px]" />
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px]">
          <Filter className="h-3.5 w-3.5" /> Filter
        </button>
        <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-0.5 text-[12px]">
          {["All", "Active", "Overdue", "Paused"].map((t, i) => (
            <button key={t} className={`px-3 py-1.5 rounded-lg transition ${i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_100px_120px_40px] gap-3 px-5 py-3 border-b border-border/60 text-[11px] uppercase tracking-widest text-muted-foreground">
          <div>Client</div><div>Contact</div><div className="text-right">Revenue</div><div className="text-center">Invoices</div><div>Status</div><div />
        </div>
        <div className="divide-y divide-border/60">
          {CLIENTS.map((c) => (
            <Link
              key={c.id}
              to="/app/clients/$id"
              params={{ id: c.id }}
              className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_100px_120px_40px] items-center gap-3 px-5 py-4 hover:bg-muted/40 transition group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-[12px] font-semibold">
                  {c.n.split(" ").map(w => w[0]).join("").slice(0,2)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{c.n}</div>
                  <div className="truncate text-[11px] text-muted-foreground">Since {c.since}</div>
                </div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px]">{c.contact}</div>
                <div className="truncate text-[11px] text-muted-foreground">{c.email}</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-medium tabular-nums">${c.rev.toLocaleString()}</div>
                <div className={`text-[11px] inline-flex items-center gap-0.5 ${c.g >= 0 ? "text-success" : "text-destructive"}`}>
                  {c.g >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                  {Math.abs(c.g)}%
                </div>
              </div>
              <div className="text-center text-[13px] tabular-nums">{c.invoices}</div>
              <div>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${toneMap[c.tone]}`}>{c.status}</span>
              </div>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
