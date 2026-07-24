import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowDownRight, Plus, Send, Sparkles, TrendingUp, Clock, Wallet, CheckCircle2, Circle, DollarSign } from "lucide-react";
import { Counter } from "@/components/silex/counter";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — SILEX" }, { name: "description", content: "Your business at a glance." }] }),
  component: Dashboard,
});

const revenueData = [
  { m: "Jan", v: 42000 }, { m: "Feb", v: 58000 }, { m: "Mar", v: 51000 },
  { m: "Apr", v: 72000 }, { m: "May", v: 68000 }, { m: "Jun", v: 84000 },
  { m: "Jul", v: 92000 }, { m: "Aug", v: 108000 }, { m: "Sep", v: 128000 },
];

const cashflowData = [
  { d: "M", i: 12, o: 8 }, { d: "T", i: 15, o: 6 }, { d: "W", i: 8, o: 10 },
  { d: "T", i: 22, o: 7 }, { d: "F", i: 18, o: 12 }, { d: "S", i: 6, o: 3 }, { d: "S", i: 4, o: 2 },
];

function Dashboard() {
  return (
    <div className="space-y-6 stagger">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Friday, July 24</div>
          <h1 className="mt-1 text-4xl font-display tracking-tight">Good morning, Ariana.</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Here's what's happening across your business today.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px] font-medium hover:border-violet/50 transition">
            <Sparkles className="h-3.5 w-3.5 text-violet" /> Ask SILEX
          </button>
          <Link to="/app/invoices/new" className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition">
            <Plus className="h-3.5 w-3.5" /> New invoice
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue · MTD" value={128420} prefix="$" trend={24.6} icon={TrendingUp} />
        <Kpi label="Pending payments" value={18240} prefix="$" trend={-4.2} icon={Clock} tone="warning" />
        <Kpi label="Cash on hand" value={94820} prefix="$" trend={12.4} icon={Wallet} tone="success" />
        <Kpi label="Paid invoices" value={42} trend={8} suffix="" icon={CheckCircle2} tone="success" />
      </div>

      {/* Main grid */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Revenue chart */}
        <div className="xl:col-span-2 rounded-3xl border border-border/70 bg-card/70 p-6 hover-lift">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Revenue</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-4xl font-display">$<Counter value={784320} /></div>
                <span className="text-[12px] font-medium text-success">+24.6% YoY</span>
              </div>
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5 text-[11px]">
              {["1M", "3M", "6M", "YTD", "1Y"].map((t, i) => (
                <button key={t} className={`px-2 py-1 rounded-md ${i === 3 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.58 0.28 295)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.58 0.28 295)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" stroke="oklch(0.5 0.02 275)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.5 0.02 275)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="v" stroke="oklch(0.32 0.14 275)" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insights */}
        <div className="rounded-3xl bg-gradient-to-br from-primary to-violet p-6 text-primary-foreground relative overflow-hidden shadow-float">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest opacity-80">
              <Sparkles className="h-3 w-3" /> AI Insights
            </div>
            <h3 className="mt-3 text-2xl font-display tracking-tight">You're on track for your best quarter yet.</h3>
            <p className="mt-2 text-[13px] opacity-80 leading-relaxed">
              At current pace, Q3 will close 18% above Q2. Two clients account for 61% of pipeline — consider outreach.
            </p>
            <div className="mt-5 space-y-2">
              {[
                "Chase INV-2039 · Nova Labs · 6 days overdue",
                "Acme Studio spend is up 34% vs last quarter",
                "Draft Q3 recap for 4 top clients",
              ].map((tip) => (
                <div key={tip} className="flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2 text-[12.5px]">
                  <Circle className="h-3 w-3 shrink-0 mt-0.5 fill-current" /> {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Cash flow */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Cash flow · 7d</div>
              <div className="mt-1 text-2xl font-display">In vs. Out</div>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" /> In</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet" /> Out</span>
            </div>
          </div>
          <div className="mt-4 h-40">
            <ResponsiveContainer>
              <BarChart data={cashflowData}>
                <XAxis dataKey="d" fontSize={11} stroke="oklch(0.5 0.02 275)" tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "oklch(0.5 0.02 275 / 0.06)" }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="i" fill="oklch(0.32 0.14 275)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="o" fill="oklch(0.58 0.28 295)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming payments */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Upcoming payments</div>
            <Link to="/app/payments" className="text-[12px] text-primary hover:underline">View all</Link>
          </div>
          <div className="mt-4 space-y-3">
            {[
              { c: "Acme Studio", d: "in 3 days", v: 12400, s: "expected" },
              { c: "Nova Labs", d: "overdue 6d", v: 8200, s: "overdue" },
              { c: "Foundry Type", d: "in 12 days", v: 4500, s: "expected" },
              { c: "Riverside", d: "in 21 days", v: 2200, s: "expected" },
            ].map((p) => (
              <div key={p.c} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-semibold">{p.c[0]}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{p.c}</div>
                    <div className={`text-[11px] ${p.s === "overdue" ? "text-destructive" : "text-muted-foreground"}`}>{p.d}</div>
                  </div>
                </div>
                <div className="text-[13px] font-medium tabular-nums">${p.v.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Quick actions</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { i: Plus, l: "New invoice", to: "/app/invoices/new" },
              { i: Send, l: "Send reminder", to: "/app/invoices" },
              { i: DollarSign, l: "Record payment", to: "/app/payments" },
              { i: Sparkles, l: "Ask SILEX", to: "/app/ai" },
            ].map((a) => (
              <Link key={a.l} to={a.to} className="group flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 hover:border-violet/50 hover-lift transition">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet/10 text-violet"><a.i className="h-4 w-4" /></span>
                <span className="text-[13px] font-medium">{a.l}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Activity + Recent clients + Invoice status */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Recent activity</div>
            <button className="text-[12px] text-primary hover:underline">Show all</button>
          </div>
          <ol className="mt-4 space-y-1 relative">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
            {[
              { t: "Payment received", d: "Acme Studio · $12,400", when: "2h ago", tone: "success" },
              { t: "Invoice sent", d: "INV-2041 · Nova Labs · $9,120", when: "5h ago" },
              { t: "SILEX AI drafted", d: "Follow-up for INV-2039", when: "Yesterday", tone: "violet" },
              { t: "New client added", d: "Riverside Media", when: "Yesterday" },
              { t: "Contract signed", d: "Foundry Type — Q3 retainer", when: "2 days ago", tone: "success" },
            ].map((a, i) => (
              <li key={i} className="relative flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-muted/40 transition">
                <span className={`z-10 mt-1.5 grid h-2 w-2 place-items-center rounded-full ${
                  a.tone === "success" ? "bg-success" : a.tone === "violet" ? "bg-violet" : "bg-muted-foreground"
                } ring-4 ring-background`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium">{a.t}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{a.d}</div>
                </div>
                <div className="text-[11px] text-muted-foreground shrink-0">{a.when}</div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Invoice status</div>
            <Link to="/app/invoices" className="text-[12px] text-primary hover:underline">Invoices</Link>
          </div>
          <div className="mt-6 grid gap-3">
            <StatusBar label="Paid" count={42} total={68} tone="bg-success" />
            <StatusBar label="Pending" count={14} total={68} tone="bg-primary" />
            <StatusBar label="Overdue" count={5} total={68} tone="bg-destructive" />
            <StatusBar label="Draft" count={7} total={68} tone="bg-muted-foreground/50" />
          </div>
          <div className="mt-6 rounded-2xl bg-muted/60 p-4">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet" /> SILEX suggests
            </div>
            <div className="mt-1 text-[13px]">Send a warm reminder to Nova Labs — average pay time 4d.</div>
          </div>
        </div>
      </div>

      {/* Recent clients */}
      <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Recent clients</div>
            <div className="mt-1 text-2xl font-display">Top relationships</div>
          </div>
          <Link to="/app/clients" className="text-[12px] text-primary hover:underline">All clients</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { n: "Acme Studio", r: 42400, g: 34, s: "Active" },
            { n: "Nova Labs", r: 28200, g: 12, s: "Overdue" },
            { n: "Foundry Type", r: 18400, g: -6, s: "Active" },
            { n: "Riverside Media", r: 12200, g: 22, s: "New" },
          ].map((c) => (
            <Link
              key={c.n}
              to="/app/clients/$id"
              params={{ id: c.n.toLowerCase().replace(/\s+/g, "-") }}
              className="rounded-2xl border border-border/70 bg-card p-4 hover:border-violet/50 hover-lift transition"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-[13px] font-semibold">
                  {c.n.split(" ").map(w => w[0]).join("").slice(0,2)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{c.n}</div>
                  <div className={`text-[11px] ${c.s === "Overdue" ? "text-destructive" : c.s === "New" ? "text-violet" : "text-muted-foreground"}`}>{c.s}</div>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Revenue</div>
                  <div className="text-lg font-display">${c.r.toLocaleString()}</div>
                </div>
                <div className={`inline-flex items-center gap-0.5 text-[12px] font-medium ${c.g >= 0 ? "text-success" : "text-destructive"}`}>
                  {c.g >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(c.g)}%
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label, value, prefix = "", suffix = "", trend, icon: Icon, tone = "primary",
}: { label: string; value: number; prefix?: string; suffix?: string; trend: number; icon: React.ComponentType<{ className?: string }>; tone?: "primary" | "success" | "warning" }) {
  const toneMap = { primary: "text-primary bg-primary/10", success: "text-success bg-success/10", warning: "text-warning bg-warning/15" };
  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-5 hover-lift">
      <div className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${trend >= 0 ? "text-success bg-success/10" : "text-destructive bg-destructive/10"}`}>
          {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(trend)}%
        </span>
      </div>
      <div className="mt-4 text-[12px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-display tracking-tight">
        <Counter value={value} prefix={prefix} suffix={suffix} />
      </div>
    </div>
  );
}

function StatusBar({ label, count, total, tone }: { label: string; count: number; total: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{count}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${tone} transition-all duration-1000`} style={{ width: `${(count / total) * 100}%` }} />
      </div>
    </div>
  );
}
