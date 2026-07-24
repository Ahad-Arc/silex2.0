import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from "recharts";
import { Counter } from "@/components/silex/counter";

export const Route = createFileRoute("/app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — SILEX" }, { name: "description", content: "Understand your business." }] }),
  component: Analytics,
});

const rev = Array.from({ length: 12 }).map((_, i) => ({
  m: ["Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep"][i],
  a: 20000 + i * 3500 + Math.sin(i) * 8000,
  b: 15000 + i * 2200 + Math.cos(i / 2) * 6000,
}));

const mix = [
  { n: "Retainer", v: 58, c: "oklch(0.32 0.14 275)" },
  { n: "Project", v: 28, c: "oklch(0.58 0.28 295)" },
  { n: "Licensing", v: 10, c: "oklch(0.65 0.15 155)" },
  { n: "Other", v: 4, c: "oklch(0.78 0.14 75)" },
];

function Analytics() {
  return (
    <div className="space-y-6 stagger">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Analytics</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">The story your numbers are telling.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-0.5 text-[12px]">
          {["7D", "30D", "90D", "YTD", "1Y", "All"].map((t, i) => (
            <button key={t} className={`px-3 py-1.5 rounded-lg transition ${i === 3 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* AI callout */}
      <div className="rounded-3xl bg-gradient-to-br from-primary to-violet text-primary-foreground p-6 shadow-float relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="text-[11px] uppercase tracking-widest opacity-70">The story</div>
            <div className="mt-1 text-2xl font-display leading-tight">Q3 will close 18% above Q2 — driven by retainer growth from Acme and Foundry.</div>
          </div>
          <button className="rounded-xl bg-white/15 backdrop-blur px-4 py-2 text-[13px] font-medium hover:bg-white/25 transition">
            Ask a follow-up
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Revenue YTD", v: 784320, p: "$" },
          { l: "New clients", v: 12, p: "" },
          { l: "MRR", v: 24800, p: "$" },
          { l: "Avg. pay time", v: 6.2, p: "", s: " days", d: 1 },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-border/70 bg-card/70 p-5 hover-lift">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">{k.l}</div>
            <div className="mt-2 text-3xl font-display">
              <Counter value={k.v} prefix={k.p} suffix={k.s ?? ""} decimals={k.d ?? 0} />
            </div>
          </div>
        ))}
      </div>

      {/* Revenue vs last year */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Revenue vs. last year</div>
              <div className="mt-1 text-2xl font-display">This year outperforming by 32%</div>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" /> This year</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted-foreground/40" /> Last year</span>
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <AreaChart data={rev}>
                <defs>
                  <linearGradient id="ya" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="oklch(0.32 0.14 275)" stopOpacity={0.3}/><stop offset="100%" stopColor="oklch(0.32 0.14 275)" stopOpacity={0}/></linearGradient>
                </defs>
                <XAxis dataKey="m" stroke="oklch(0.5 0.02 275)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.5 0.02 275)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="b" stroke="oklch(0.5 0.02 275 / 0.5)" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
                <Area type="monotone" dataKey="a" stroke="oklch(0.32 0.14 275)" strokeWidth={2.5} fill="url(#ya)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mix */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Revenue mix</div>
          <div className="mt-2 h-56 relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={mix} dataKey="v" innerRadius={62} outerRadius={90} paddingAngle={4} stroke="none">
                  {mix.map((m, i) => <Cell key={i} fill={m.c} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
              <div>
                <div className="text-3xl font-display">58%</div>
                <div className="text-[11px] text-muted-foreground">Retainer</div>
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
            {mix.map((m) => (
              <div key={m.n} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: m.c }} />
                <span className="text-muted-foreground">{m.n}</span>
                <span className="ml-auto tabular-nums">{m.v}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Client leaderboard */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Top clients</div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={[
                { n: "Acme", v: 42400 }, { n: "Nova", v: 28200 }, { n: "Foundry", v: 18400 }, { n: "Riverside", v: 12200 }, { n: "Kite", v: 8600 }, { n: "Orbit", v: 6200 },
              ]} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" stroke="oklch(0.5 0.02 275)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                <YAxis dataKey="n" type="category" stroke="oklch(0.5 0.02 275)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="v" fill="oklch(0.58 0.28 295)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Forecast — next 90 days</div>
            <span className="inline-flex items-center gap-1 text-[11px] text-violet"><TrendingUp className="h-3 w-3" /> AI</span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <LineChart data={Array.from({length: 12}).map((_, i) => ({ x: i, y: 84000 + i * 4200 + Math.sin(i)*4000, l: 84000 + i * 3400, u: 84000 + i * 5000 }))}>
                <XAxis dataKey="x" stroke="oklch(0.5 0.02 275)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.5 0.02 275)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Line dataKey="l" stroke="oklch(0.58 0.28 295 / 0.3)" strokeWidth={1} dot={false} />
                <Line dataKey="u" stroke="oklch(0.58 0.28 295 / 0.3)" strokeWidth={1} dot={false} />
                <Line dataKey="y" stroke="oklch(0.32 0.14 275)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
