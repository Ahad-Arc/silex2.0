import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Filter, Plus, MoreHorizontal, Send, Download } from "lucide-react";

export const Route = createFileRoute("/app/invoices")({
  head: () => ({ meta: [{ title: "Invoices — SILEX" }, { name: "description", content: "Every invoice, calmly managed." }] }),
  component: Invoices,
});

const INVOICES = [
  { id: "2041", c: "Nova Labs", d: "Sep 24", due: "Oct 8", v: 9120, s: "Sent", tone: "primary" },
  { id: "2040", c: "Acme Studio", d: "Sep 22", due: "Oct 6", v: 12400, s: "Paid", tone: "success" },
  { id: "2039", c: "Nova Labs", d: "Sep 10", due: "Sep 24", v: 8200, s: "Overdue", tone: "destructive" },
  { id: "2038", c: "Foundry Type", d: "Sep 08", due: "Sep 22", v: 4500, s: "Paid", tone: "success" },
  { id: "2037", c: "Riverside Media", d: "Sep 04", due: "Sep 18", v: 2200, s: "Paid", tone: "success" },
  { id: "2036", c: "Kite Club", d: "Aug 28", due: "Sep 11", v: 3400, s: "Paid", tone: "success" },
  { id: "2035", c: "Acme Studio", d: "Aug 21", due: "Sep 04", v: 12400, s: "Paid", tone: "success" },
  { id: "2034", c: "Orbit House", d: "Aug 15", due: "Aug 29", v: 6200, s: "Draft", tone: "muted" },
];

const toneMap: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

function Invoices() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Invoices</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Draft, send, and get paid.</p>
        </div>
        <Link to="/app/invoices/new" className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition">
          <Plus className="h-3.5 w-3.5" /> New invoice
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Outstanding", v: "$18,240", d: "3 invoices" },
          { l: "Overdue", v: "$8,200", d: "1 invoice", tone: "destructive" },
          { l: "Paid this month", v: "$54,700", d: "9 invoices", tone: "success" },
          { l: "Draft", v: "$6,200", d: "1 invoice" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border/70 bg-card/70 p-5 hover-lift">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
            <div className={`mt-2 text-3xl font-display ${s.tone === "destructive" ? "text-destructive" : s.tone === "success" ? "text-success" : ""}`}>{s.v}</div>
            <div className="text-[12px] text-muted-foreground">{s.d}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 flex-1 min-w-[240px] focus-within:border-violet/60 transition">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Search invoices, clients, amounts..." className="flex-1 bg-transparent outline-none text-[13px]" />
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px]">
          <Filter className="h-3.5 w-3.5" /> Filter
        </button>
        <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-0.5 text-[12px]">
          {["All", "Sent", "Paid", "Overdue", "Draft"].map((t, i) => (
            <button key={t} className={`px-3 py-1.5 rounded-lg transition ${i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
        <div className="grid grid-cols-[100px_minmax(0,1.5fr)_120px_120px_120px_120px_40px] gap-3 px-5 py-3 border-b border-border/60 text-[11px] uppercase tracking-widest text-muted-foreground">
          <div>Invoice</div><div>Client</div><div>Issued</div><div>Due</div><div className="text-right">Amount</div><div>Status</div><div />
        </div>
        <div className="divide-y divide-border/60">
          {INVOICES.map((i) => (
            <Link
              key={i.id}
              to="/app/invoices/$id"
              params={{ id: i.id }}
              className="grid grid-cols-[100px_minmax(0,1.5fr)_120px_120px_120px_120px_40px] items-center gap-3 px-5 py-4 hover:bg-muted/40 transition group"
            >
              <div className="font-mono text-[13px] font-medium">#{i.id}</div>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-[11px] font-semibold">{i.c[0]}</span>
                <span className="truncate text-[13.5px]">{i.c}</span>
              </div>
              <div className="text-[12.5px] text-muted-foreground">{i.d}</div>
              <div className="text-[12.5px] text-muted-foreground">{i.due}</div>
              <div className="text-right text-[13.5px] font-medium tabular-nums">${i.v.toLocaleString()}</div>
              <div><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${toneMap[i.tone]}`}>{i.s}</span></div>
              <div className="flex justify-end opacity-0 group-hover:opacity-100 transition">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
