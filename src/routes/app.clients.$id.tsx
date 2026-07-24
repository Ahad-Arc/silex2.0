import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, Phone, Globe, MapPin, MoreHorizontal, Plus, FileText, MessageSquare, Sparkles, Download } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/app/clients/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${prettyName(params.id)} — SILEX` },
      { name: "description", content: `Client profile for ${prettyName(params.id)}.` },
    ],
  }),
  component: ClientDetail,
});

function prettyName(id: string) {
  return id.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ");
}

const trend = Array.from({ length: 12 }).map((_, i) => ({ x: i, y: 20 + Math.sin(i / 2) * 12 + i * 3 }));

function ClientDetail() {
  const { id } = Route.useParams();
  const name = prettyName(id);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2);

  return (
    <div className="space-y-6 stagger">
      <Link to="/app/clients" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Link>

      {/* Header card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-6">
        <div className="absolute inset-x-0 top-0 h-32 bg-aurora opacity-70" />
        <div className="relative flex flex-wrap items-start gap-5">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-xl font-semibold shadow-float">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-display tracking-tight">{name}</h1>
              <span className="rounded-full bg-success/10 text-success text-[11px] font-medium px-2 py-0.5">Active</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> ellie@acme.co</span>
              <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> +1 (415) 555-0192</span>
              <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> acme.co</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Brooklyn, NY</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[13px] font-medium hover:border-violet/50 transition">
              <MessageSquare className="h-3.5 w-3.5" /> Message
            </button>
            <Link to="/app/invoices/new" className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition">
              <Plus className="h-3.5 w-3.5" /> New invoice
            </Link>
            <button className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card"><MoreHorizontal className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          {/* KPIs */}
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { l: "Lifetime value", v: "$42,400" },
              { l: "Avg. invoice", v: "$5,300" },
              { l: "Pay time", v: "6.2 days" },
              { l: "Projects", v: "12" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
                <div className="mt-1 text-2xl font-display">{s.v}</div>
              </div>
            ))}
          </div>

          {/* Revenue trend */}
          <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Revenue with {name}</div>
                <div className="mt-1 text-3xl font-display">$42,400</div>
              </div>
              <span className="text-[12px] font-medium text-success">+34% YoY</span>
            </div>
            <div className="mt-4 h-32">
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="c1" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.58 0.28 295)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="oklch(0.58 0.28 295)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area dataKey="y" stroke="oklch(0.32 0.14 275)" strokeWidth={2} fill="url(#c1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Invoices */}
          <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
              <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Invoices</div>
              <Link to="/app/invoices" className="text-[12px] text-primary hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-border/60">
              {[
                { n: "INV-2041", d: "Sep 22", v: 9120, s: "Paid", tone: "success" },
                { n: "INV-2035", d: "Aug 30", v: 12400, s: "Paid", tone: "success" },
                { n: "INV-2028", d: "Aug 04", v: 8600, s: "Paid", tone: "success" },
                { n: "INV-2019", d: "Jul 18", v: 4800, s: "Overdue", tone: "destructive" },
              ].map((i) => (
                <div key={i.n} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/40 transition">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted"><FileText className="h-4 w-4 text-muted-foreground" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{i.n}</div>
                    <div className="text-[11px] text-muted-foreground">{i.d}</div>
                  </div>
                  <div className="text-[13px] font-medium tabular-nums">${i.v.toLocaleString()}</div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${i.tone === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{i.s}</span>
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* AI summary */}
          <div className="rounded-3xl bg-gradient-to-br from-primary to-violet text-primary-foreground p-5 shadow-float">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest opacity-80">
              <Sparkles className="h-3 w-3" /> AI summary
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed opacity-95">
              Your longest-standing client. Brand & product work, primarily quarterly retainer. Pays ahead of terms (avg 4d). Ellie prefers Loom updates over meetings.
            </p>
            <button className="mt-4 rounded-lg bg-white/15 backdrop-blur px-3 py-1.5 text-[12px] font-medium hover:bg-white/25">
              Draft check-in email
            </button>
          </div>

          {/* Notes */}
          <div className="rounded-3xl border border-border/70 bg-card/70 p-5">
            <div className="flex items-center justify-between">
              <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Notes</div>
              <button className="text-[12px] text-primary hover:underline">Add</button>
            </div>
            <ol className="mt-4 space-y-3 text-[13px]">
              {[
                { d: "Sep 12", n: "Kickoff for Q4 brand refresh — deck due Oct 2." },
                { d: "Aug 20", n: "Ellie mentioned new product launch mid-Q4. Potential upsell." },
                { d: "Jul 04", n: "Prefers async. Loom > Zoom." },
              ].map((n) => (
                <li key={n.d} className="border-l-2 border-violet/60 pl-3">
                  <div className="text-[11px] text-muted-foreground">{n.d}</div>
                  <div>{n.n}</div>
                </li>
              ))}
            </ol>
          </div>

          {/* Files */}
          <div className="rounded-3xl border border-border/70 bg-card/70 p-5">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Files & contracts</div>
            <div className="mt-4 space-y-2 text-[13px]">
              {["Acme MSA 2025.pdf", "Brand Guidelines v3.pdf", "Q4 Statement of Work.pdf"].map((f) => (
                <div key={f} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 hover:border-violet/40 transition">
                  <span className="flex items-center gap-2 truncate"><FileText className="h-3.5 w-3.5 text-muted-foreground" /> {f}</span>
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
