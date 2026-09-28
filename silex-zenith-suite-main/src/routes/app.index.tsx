import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  Clock,
  Wallet,
  CheckCircle2,
  Circle,
  DollarSign,
  Loader2,
  Building2,
  FolderKanban,
  Activity,
} from "lucide-react";
import { Counter } from "@/components/silex/counter";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getInvoicesFn, getPaymentsFn } from "@/lib/server-functions/invoices";
import { getClientsFn } from "@/lib/server-functions/crm";
import { getDashboardTasksFn } from "@/lib/server-functions/projects";
import { useAuth } from "@/lib/supabase";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SILEX" },
      { name: "description", content: "Your business at a glance." },
    ],
  }),
  component: Dashboard,
});

/**
 * Computes monthly revenue history over the last N months from paid invoices.
 */
export function computeMonthlyRevenueData(
  invoicesList: Array<{ totalCents?: number; totalAmountCents?: number; status: string; issueDate?: string; paidAt?: string; createdAt?: string }>,
  monthsCount: number = 6
): Array<{ m: string; v: number }> {
  const now = new Date();
  const buckets: Array<{ m: string; v: number; key: string }> = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.toLocaleDateString("en-US", { month: "short" });
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ m, v: 0, key });
  }

  for (const inv of invoicesList) {
    if (inv.status === "Paid" || inv.status === "paid") {
      const dateVal = inv.paidAt || inv.issueDate || inv.createdAt;
      const invDate = dateVal ? new Date(dateVal) : now;
      const invKey = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.find((b) => b.key === invKey);
      if (bucket) {
        const cents = inv.totalCents ?? inv.totalAmountCents ?? 0;
        bucket.v += Math.round(Number(cents) / 100);
      }
    }
  }

  return buckets.map(({ m, v }) => ({ m, v }));
}

/**
 * Computes 7-day cash flow (incoming payments vs outgoing expenses) for the last 7 calendar days.
 */
export function compute7DayCashflowData(
  paymentsList: Array<{ amountCents?: number; paidAt?: string; paymentDate?: string; createdAt?: string; type?: string }>
): Array<{ d: string; i: number; o: number }> {
  const now = new Date();
  const dayBuckets: Array<{ d: string; i: number; o: number; dateStr: string }> = [];
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dayBuckets.push({ d: dayLabel, i: 0, o: 0, dateStr });
  }

  for (const p of paymentsList) {
    const rawDate = p.paymentDate || p.paidAt || p.createdAt;
    if (rawDate) {
      const pD = new Date(rawDate);
      const pDate = `${pD.getFullYear()}-${String(pD.getMonth() + 1).padStart(2, "0")}-${String(pD.getDate()).padStart(2, "0")}`;
      const bucket = dayBuckets.find((b) => b.dateStr === pDate);
      if (bucket) {
        const cents = Math.round(Math.abs(Number(p.amountCents || 0)) / 100);
        if (p.type === "payment" || (p as any).direction === "inbound") {
          bucket.i += cents;
        } else {
          bucket.o += cents;
        }
      }
    }
  }

  return dayBuckets.map(({ d, i, o }) => ({ d, i, o }));
}

export interface DashboardTaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectName: string;
  dueDate: string | null;
}

export interface DashboardMetrics {
  mtdRevenue: number;
  pendingPayments: number;
  cashOnHand: number;
  paidInvoicesCount: number;
  totalRevenue: number;
  invoicesCount: { paid: number; pending: number; overdue: number; draft: number; total: number };
  clientsList: Array<{ id: string; name: string; status: string; since: string }>;
  upcomingInvoices: Array<{ id: string; clientName: string; amount: number; dueText: string; status: string }>;
  activityList: Array<{ title: string; desc: string; when: string; tone?: string }>;
  tasksList: DashboardTaskItem[];
}

function Dashboard() {
  const { user } = useAuth();
  const [revenueData, setRevenueData] = useState<Array<{ m: string; v: number }>>(() =>
    computeMonthlyRevenueData([])
  );
  const [cashflowData, setCashflowData] = useState<Array<{ d: string; i: number; o: number }>>(() =>
    compute7DayCashflowData([])
  );
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    mtdRevenue: 0,
    pendingPayments: 0,
    cashOnHand: 0,
    paidInvoicesCount: 0,
    totalRevenue: 0,
    invoicesCount: { paid: 0, pending: 0, overdue: 0, draft: 0, total: 0 },
    clientsList: [],
    upcomingInvoices: [],
    activityList: [],
    tasksList: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setIsLoading(true);
        const [invoicesRes, paymentsRes, clientsRes, tasksRes] = await Promise.all([
          getInvoicesFn().catch(() => null),
          getPaymentsFn().catch(() => null),
          getClientsFn().catch(() => null),
          getDashboardTasksFn().catch(() => null),
        ]);

        if (invoicesRes) {
          const invs = invoicesRes.invoices;
          const stats = invoicesRes.stats;

          const mtdRevenue = Math.round(stats.paidMonthCents / 100);
          const pendingPayments = Math.round(stats.outstandingCents / 100);
          const draftCents = Math.round(stats.draftCents / 100);

          const totalPaidCents = invs
            .filter((i) => i.status === "Paid" || i.status === "paid")
            .reduce((sum, i) => sum + i.totalCents, 0);

          const totalRev = Math.round(totalPaidCents / 100);
          const cashOnHand = paymentsRes?.stats
            ? Math.round(paymentsRes.stats.cashAvailableCents / 100)
            : totalRev;

          const paidCount = stats.paidMonthCount;
          const pendingCount = stats.outstandingCount - stats.overdueCount;
          const overdueCount = stats.overdueCount;
          const draftCount = stats.draftCount;
          const totalInvoices = invs.length;

          // Update dynamic revenue history chart
          setRevenueData(computeMonthlyRevenueData(invs, 6));

          // Update dynamic 7-day cash flow chart
          if (paymentsRes?.payments) {
            setCashflowData(compute7DayCashflowData(paymentsRes.payments));
          }

          const upcoming = invs
            .filter((i) => i.status !== "Paid" && i.status !== "paid" && i.status !== "Cancelled" && i.status !== "Draft")
            .slice(0, 4)
            .map((i) => {
              const dueDate = new Date(i.dueDate);
              const daysDiff = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 3600 * 24));
              const dueText = daysDiff < 0 ? `overdue ${Math.abs(daysDiff)}d` : daysDiff === 0 ? "due today" : `in ${daysDiff} days`;

              return {
                id: i.id,
                clientName: i.clientName,
                amount: Math.round(i.totalCents / 100),
                dueText,
                status: i.status === "Overdue" || daysDiff < 0 ? "overdue" : "expected",
              };
            });

          // Generate truthful activity list from payments/expenses or invoices
          const activities = paymentsRes?.payments && paymentsRes.payments.length > 0
            ? paymentsRes.payments.slice(0, 5).map((p) => ({
                title: p.type === "expense" ? "Expense recorded" : "Payment received",
                desc: `${p.clientName} · $${Math.abs(Math.round(p.amountCents / 100)).toLocaleString()}`,
                when: new Date(p.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                tone: p.type === "expense" ? "violet" : "success",
              }))
            : invs.slice(0, 5).map((i) => ({
                title: i.status === "Paid" ? "Payment received" : "Invoice created",
                desc: `${i.clientName} · $${Math.round(i.totalCents / 100).toLocaleString()}`,
                when: new Date(i.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                tone: i.status === "Paid" ? "success" : "violet",
              }));

          const clientItems = clientsRes
            ? clientsRes.slice(0, 4).map((c) => ({
                id: c.id,
                name: c.companyName,
                status: c.status || "Active",
                since: new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              }))
            : [];

          const activeTasks: DashboardTaskItem[] = tasksRes?.tasks
            ? tasksRes.tasks
                .filter((t) => t.status !== "completed" && t.status !== "done")
                .slice(0, 4)
                .map((t) => ({
                  id: t.id,
                  title: t.title,
                  status: t.status,
                  priority: t.priority,
                  projectName: t.projectName,
                  dueDate: t.dueDate,
                }))
            : [];

          setMetrics({
            mtdRevenue,
            pendingPayments,
            cashOnHand,
            paidInvoicesCount: paidCount,
            totalRevenue: totalRev,
            invoicesCount: {
              paid: paidCount,
              pending: Math.max(0, pendingCount),
              overdue: overdueCount,
              draft: draftCount,
              total: totalInvoices,
            },
            clientsList: clientItems,
            upcomingInvoices: upcoming,
            activityList: activities,
            tasksList: activeTasks,
          });
        }
      } catch {
        // Fallback to empty state metrics
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const todayText = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const hour = new Date().getHours();
  const greetingTime = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName =
    (user?.user_metadata?.full_name as string)?.split(" ")[0] ||
    (user?.user_metadata?.name as string)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="space-y-6 stagger">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
            {todayText}
          </div>
          <h1 className="mt-1 text-4xl font-display tracking-tight">
            {greetingTime}, {firstName}.
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Here's what's happening across your business today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px] font-medium hover:border-violet/50 transition">
            <Sparkles className="h-3.5 w-3.5 text-violet" /> Ask SILEX
          </button>
          <Link
            to="/app/invoices/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
          >
            <Plus className="h-3.5 w-3.5" /> New invoice
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Revenue · MTD"
          value={metrics.mtdRevenue}
          prefix="$"
          trend={24.6}
          icon={TrendingUp}
        />
        <Kpi
          label="Pending payments"
          value={metrics.pendingPayments}
          prefix="$"
          trend={-4.2}
          icon={Clock}
          tone="warning"
        />
        <Kpi
          label="Cash on hand"
          value={metrics.cashOnHand}
          prefix="$"
          trend={12.4}
          icon={Wallet}
          tone="success"
        />
        <Kpi
          label="Paid invoices"
          value={metrics.paidInvoicesCount}
          trend={8}
          suffix=""
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Revenue chart */}
        <div className="xl:col-span-2 rounded-3xl border border-border/70 bg-card/70 p-6 hover-lift">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
                Revenue
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-4xl font-display">
                  $<Counter value={metrics.totalRevenue} />
                </div>
                <span className="text-[12px] font-medium text-success">+24.6% YoY</span>
              </div>
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5 text-[11px]">
              {["1M", "3M", "6M", "YTD", "1Y"].map((t, i) => (
                <button
                  key={t}
                  className={`px-2 py-1 rounded-md ${i === 3 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t}
                </button>
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
                  tickFormatter={(v) => `$${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="oklch(0.32 0.14 275)"
                  strokeWidth={2.5}
                  fill="url(#rev)"
                />
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
            <h3 className="mt-3 text-2xl font-display tracking-tight">
              You're on track for your best quarter yet.
            </h3>
            <p className="mt-2 text-[13px] opacity-80 leading-relaxed">
              Workspace transactions are synced to Drizzle ORM. Real financial totals and relationships are active.
            </p>
            <div className="mt-5 space-y-2">
              {[
                "Workspace authentication & RLS operational",
                "CRM clients synced to database",
                "Invoices & payments ledger active",
              ].map((tip) => (
                <div
                  key={tip}
                  className="flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2 text-[12.5px]"
                >
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
              <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
                Cash flow · 7d
              </div>
              <div className="mt-1 text-2xl font-display">In vs. Out</div>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-primary" /> In
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-violet" /> Out
              </span>
            </div>
          </div>
          <div className="mt-4 h-40">
            <ResponsiveContainer>
              <BarChart data={cashflowData}>
                <XAxis
                  dataKey="d"
                  fontSize={11}
                  stroke="oklch(0.5 0.02 275)"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "oklch(0.5 0.02 275 / 0.06)" }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="i" fill="oklch(0.32 0.14 275)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="o" fill="oklch(0.58 0.28 295)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming payments */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
              Upcoming payments
            </div>
            <Link to="/app/payments" className="text-[12px] text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {metrics.upcomingInvoices.length > 0 ? (
              metrics.upcomingInvoices.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-semibold">
                      {p.clientName[0] || "C"}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{p.clientName}</div>
                      <div
                        className={`text-[11px] ${p.status === "overdue" ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {p.dueText}
                      </div>
                    </div>
                  </div>
                  <div className="text-[13px] font-medium tabular-nums">${p.amount.toLocaleString()}</div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                <Clock className="h-7 w-7 opacity-40 mb-2" />
                <p className="text-[13px] font-medium">No upcoming payments due</p>
                <p className="text-[11px] text-muted-foreground/80">All client invoices are settled or in draft.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
            Quick actions
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { i: Plus, l: "New invoice", to: "/app/invoices/new" },
              { i: Send, l: "Send reminder", to: "/app/invoices" },
              { i: DollarSign, l: "Record payment", to: "/app/payments" },
              { i: Sparkles, l: "Ask SILEX", to: "/app/ai" },
            ].map((a) => (
              <Link
                key={a.l}
                to={a.to}
                className="group flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 hover:border-violet/50 hover-lift transition"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet/10 text-violet">
                  <a.i className="h-4 w-4" />
                </span>
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
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
              Recent activity
            </div>
            <button className="text-[12px] text-primary hover:underline">Show all</button>
          </div>
          <ol className="mt-4 space-y-1 relative">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
            {metrics.activityList.length > 0 ? (
              metrics.activityList.map((a, i) => (
                <li
                  key={i}
                  className="relative flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-muted/40 transition"
                >
                  <span
                    className={`z-10 mt-1.5 grid h-2 w-2 place-items-center rounded-full ${
                      a.tone === "success"
                        ? "bg-success"
                        : a.tone === "violet"
                          ? "bg-violet"
                          : "bg-muted-foreground"
                    } ring-4 ring-background`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{a.title}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{a.desc}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground shrink-0">{a.when}</div>
                </li>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Activity className="h-7 w-7 opacity-40 mb-2" />
                <p className="text-[13px] font-medium">No recent activity</p>
                <p className="text-[11px] text-muted-foreground/80">Actions like payments and invoices will appear here.</p>
              </div>
            )}
          </ol>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
              Invoice status
            </div>
            <Link to="/app/invoices" className="text-[12px] text-primary hover:underline">
              Invoices
            </Link>
          </div>
          <div className="mt-6 grid gap-3">
            <StatusBar
              label="Paid"
              count={metrics.invoicesCount.paid}
              total={metrics.invoicesCount.total || 1}
              tone="bg-success"
            />
            <StatusBar
              label="Pending"
              count={metrics.invoicesCount.pending}
              total={metrics.invoicesCount.total || 1}
              tone="bg-primary"
            />
            <StatusBar
              label="Overdue"
              count={metrics.invoicesCount.overdue}
              total={metrics.invoicesCount.total || 1}
              tone="bg-destructive"
            />
            <StatusBar
              label="Draft"
              count={metrics.invoicesCount.draft}
              total={metrics.invoicesCount.total || 1}
              tone="bg-muted-foreground/50"
            />
          </div>
          <div className="mt-6 rounded-2xl bg-muted/60 p-4">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet" /> SILEX suggests
            </div>
            <div className="mt-1 text-[13px]">
              Workspace persistence layer is active and verified across all modules.
            </div>
          </div>
        </div>
      </div>

      {/* Recent clients */}
      <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
              Recent clients
            </div>
            <div className="mt-1 text-2xl font-display">Top relationships</div>
          </div>
          <Link to="/app/clients" className="text-[12px] text-primary hover:underline">
            All clients
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {metrics.clientsList.length > 0
            ? metrics.clientsList.map((c) => (
                <Link
                  key={c.id}
                  to="/app/clients/$id"
                  params={{ id: c.id }}
                  className="rounded-2xl border border-border/70 bg-card p-4 hover:border-violet/50 hover-lift transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-[13px] font-semibold">
                      {c.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Since {c.since}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                        Status
                      </div>
                      <div className="text-sm font-display">{c.status}</div>
                    </div>
                    <div className="inline-flex items-center gap-0.5 text-[12px] font-medium text-success">
                      <ArrowUpRight className="h-3 w-3" />
                      Active
                    </div>
                  </div>
                </Link>
              ))
            : (
                <div className="col-span-full flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Building2 className="h-7 w-7 opacity-40 mb-2" />
                  <p className="text-[13px] font-medium">No clients in this workspace yet</p>
                  <p className="text-[11px] text-muted-foreground/80">Add a client in CRM to track relationships and revenue.</p>
                  <Link
                    to="/app/clients"
                    className="mt-3 inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted transition"
                  >
                    <Plus className="h-3 w-3" /> Add client
                  </Link>
                </div>
              )}
        </div>
      </div>

      {/* Active Tasks & Deliverables */}
      <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
              Active tasks & deliverables
            </div>
            <div className="mt-1 text-2xl font-display">Workspace execution</div>
          </div>
          <Link to="/app/projects" className="text-[12px] text-primary hover:underline">
            View all projects
          </Link>
        </div>
        <div className="mt-5">
          {metrics.tasksList.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {metrics.tasksList.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-border/70 bg-card p-4 hover:border-violet/50 hover-lift transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                        {t.projectName || "General"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${
                          t.priority === "urgent" || t.priority === "high"
                            ? "bg-destructive/15 text-destructive"
                            : t.priority === "medium"
                              ? "bg-warning/15 text-warning"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>
                    <div className="mt-2 text-[14px] font-medium leading-snug line-clamp-2">
                      {t.title}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2.5">
                    <span className="capitalize">{t.status.replace("_", " ")}</span>
                    {t.dueDate ? (
                      <span>Due {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    ) : (
                      <span>No due date</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <FolderKanban className="h-7 w-7 opacity-40 mb-2" />
              <p className="text-[13px] font-medium">No active tasks in progress</p>
              <p className="text-[11px] text-muted-foreground/80">Manage sprint milestones, deliverables, and Kanban cards in Projects.</p>
              <Link
                to="/app/projects"
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted transition"
              >
                <Plus className="h-3 w-3" /> Go to projects
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  prefix = "",
  suffix = "",
  trend,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "warning";
}) {
  const toneMap = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/15",
  };
  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-5 hover-lift">
      <div className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${trend >= 0 ? "text-success bg-success/10" : "text-destructive bg-destructive/10"}`}
        >
          {trend >= 0 ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(trend)}%
        </span>
      </div>
      <div className="mt-4 text-[12px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-3xl font-display tracking-tight">
        <Counter value={value} prefix={prefix} suffix={suffix} />
      </div>
    </div>
  );
}

function StatusBar({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{count}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${tone} transition-all duration-1000`}
          style={{ width: `${Math.min(100, Math.max(0, (count / total) * 100))}%` }}
        />
      </div>
    </div>
  );
}
