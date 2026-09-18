import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";
import { Counter } from "@/components/silex/counter";
import {
  getAnalyticsSummaryFn,
  type AnalyticsTimeframe,
  type AnalyticsSummaryResponse,
} from "@/lib/server-functions/analytics";

export const Route = createFileRoute("/app/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — SILEX" },
      { name: "description", content: "Understand your business." },
    ],
  }),
  component: Analytics,
});

const timeframeList: AnalyticsTimeframe[] = ["7D", "30D", "90D", "YTD", "1Y", "All"];

function Analytics() {
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>("YTD");
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAnalytics = async (tf: AnalyticsTimeframe) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getAnalyticsSummaryFn({ data: { timeframe: tf } });
      setData(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load workspace analytics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeframe);
  }, [timeframe]);

  const kpiCards = [
    {
      l: "Revenue YTD",
      v: data?.kpis.revenueYtdDollars ?? 0,
      p: "$",
      s: "",
      d: 0,
    },
    {
      l: "New clients",
      v: data?.kpis.newClientsCount ?? 0,
      p: "",
      s: "",
      d: 0,
    },
    {
      l: "MRR",
      v: data?.kpis.mrrDollars ?? 0,
      p: "$",
      s: data?.kpis.hasRecurringData ? "" : " (N/A)",
      d: 0,
    },
    {
      l: "Avg. pay time",
      v: data?.kpis.avgPayTimeDays ?? 0,
      p: "",
      s: " days",
      d: 1,
    },
  ];

  const revenueVsLastYearData = data?.revenueVsLastYear || [];
  const revenueMixData = data?.revenueMix || [];
  const topClientsData = data?.topClients || [];
  const forecastData = data?.forecastNext90Days || [];
  const topMix = revenueMixData.find((m) => m.v > 0) || revenueMixData[0] || { n: "Paid", v: 0 };

  return (
    <div className="space-y-6 stagger">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Analytics</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            The story your numbers are telling.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-0.5 text-[12px]">
          {timeframeList.map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeframe === t
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 flex items-center justify-between text-destructive">
          <div className="flex items-center gap-2 text-[14px]">
            <AlertCircle className="h-5 w-5" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => fetchAnalytics(timeframe)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-[12px] hover:opacity-90 transition font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* AI Callout */}
      <div className="rounded-3xl bg-gradient-to-br from-primary to-violet text-primary-foreground p-6 shadow-float relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Sparkles className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="text-[11px] uppercase tracking-widest opacity-70">The story</div>
            <div className="mt-1 text-2xl font-display leading-tight">
              {isLoading ? "Calculating workspace analytics..." : data?.aiStory}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.l} className="rounded-2xl border border-border/70 bg-card/70 p-5 hover-lift relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-card/80 flex items-center justify-center backdrop-blur-xs z-10">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">{k.l}</div>
            <div className="mt-2 text-3xl font-display">
              <Counter value={k.v} prefix={k.p} suffix={k.s} decimals={k.d} />
            </div>
          </div>
        ))}
      </div>

      {/* Revenue vs last year */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-border/70 bg-card/70 p-6 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-card/80 flex items-center justify-center backdrop-blur-xs z-10 rounded-3xl">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
                Revenue vs. last year
              </div>
              <div className="mt-1 text-2xl font-display">
                {data?.outperformingPercent && data.outperformingPercent > 0
                  ? `This period outperforming by ${data.outperformingPercent}%`
                  : "Revenue comparison by month"}
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-primary" /> This year
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-muted-foreground/40" /> Last year
              </span>
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <AreaChart data={revenueVsLastYearData}>
                <defs>
                  <linearGradient id="ya" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.32 0.14 275)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.32 0.14 275)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="m"
                  stroke="oklch(0.5 0.02 275)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="oklch(0.5 0.02 275)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(val: number) => [`$${val.toLocaleString()}`, ""]}
                />
                <Area
                  type="monotone"
                  dataKey="b"
                  stroke="oklch(0.5 0.02 275 / 0.5)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="transparent"
                />
                <Area
                  type="monotone"
                  dataKey="a"
                  stroke="oklch(0.32 0.14 275)"
                  strokeWidth={2.5}
                  fill="url(#ya)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mix */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-card/80 flex items-center justify-center backdrop-blur-xs z-10 rounded-3xl">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
            Revenue mix (Invoice Status)
          </div>
          <div className="mt-2 h-56 relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={revenueMixData}
                  dataKey="v"
                  innerRadius={62}
                  outerRadius={90}
                  paddingAngle={4}
                  stroke="none"
                >
                  {revenueMixData.map((m, i) => (
                    <Cell key={i} fill={m.c} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
              <div>
                <div className="text-3xl font-display">{topMix.v}%</div>
                <div className="text-[11px] text-muted-foreground">{topMix.n}</div>
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
            {revenueMixData.map((m) => (
              <div key={m.n} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: m.c }} />
                <span className="text-muted-foreground">{m.n}</span>
                <span className="ml-auto tabular-nums">{m.v}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Client leaderboard & Forecast */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-card/80 flex items-center justify-center backdrop-blur-xs z-10 rounded-3xl">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
            Top clients (Revenue)
          </div>
          <div className="mt-4 h-64">
            {topClientsData.length === 0 || topClientsData.every((c) => c.v === 0) ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-[13px]">
                No paid client revenue recorded yet
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={topClientsData} layout="vertical" margin={{ left: 30 }}>
                  <XAxis
                    type="number"
                    stroke="oklch(0.5 0.02 275)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                  />
                  <YAxis
                    dataKey="n"
                    type="category"
                    stroke="oklch(0.5 0.02 275)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(val: number) => [`$${val.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="v" fill="oklch(0.58 0.28 295)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-6 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-card/80 flex items-center justify-center backdrop-blur-xs z-10 rounded-3xl">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
              Forecast — next 90 days
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-violet">
              <TrendingUp className="h-3 w-3" /> Projection
            </span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <LineChart data={forecastData}>
                <XAxis
                  dataKey="x"
                  stroke="oklch(0.5 0.02 275)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="oklch(0.5 0.02 275)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(val: number) => [`$${val.toLocaleString()}`, "Forecast"]}
                />
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
