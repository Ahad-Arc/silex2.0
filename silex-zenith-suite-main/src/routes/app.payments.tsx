import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowDownRight, ArrowUpRight, CreditCard, Building2, Wallet, Loader2, AlertCircle } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Counter } from "@/components/silex/counter";
import { getPaymentsFn } from "@/lib/server-functions/invoices";

export const Route = createFileRoute("/app/payments")({
  head: () => ({
    meta: [
      { title: "Payments — SILEX" },
      { name: "description", content: "Payments, payouts, and cash." },
    ],
  }),
  component: Payments,
});

const flow = Array.from({ length: 24 }).map((_, i) => ({
  x: i,
  y: 30 + Math.sin(i / 3) * 15 + i * 1.5,
}));

interface PaymentItem {
  id: string;
  clientName: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  paymentMethod: string;
  transactionReference: string | null;
  paidAt: string;
}

interface PaymentStats {
  cashAvailableCents: number;
  incomingCents: number;
  outgoingCents: number;
}

const toneMap: Record<string, string> = {
  Card: "bg-success/10 text-success",
  Bank: "bg-primary/10 text-primary",
  Payout: "bg-muted text-muted-foreground",
};

function Payments() {
  const [paymentsList, setPaymentsList] = useState<PaymentItem[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    cashAvailableCents: 0,
    incomingCents: 0,
    outgoingCents: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadPayments() {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        const res = await getPaymentsFn();
        if (res) {
          setPaymentsList(res.payments);
          setStats(res.stats);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load payments ledger.");
      } finally {
        setIsLoading(false);
      }
    }

    loadPayments();
  }, []);

  return (
    <div className="space-y-6 stagger">
      <div>
        <h1 className="text-4xl font-display tracking-tight">Payments</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Money in, money out, all in one calm view.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-primary text-primary-foreground p-6 relative overflow-hidden shadow-float">
          <div className="absolute inset-0 bg-mesh-dark opacity-70" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest opacity-80">
              <Wallet className="h-3 w-3" /> Cash available
            </div>
            <div className="mt-4 text-5xl font-display">
              $<Counter value={Math.round(stats.cashAvailableCents / 100)} />
            </div>
            <div className="mt-1 text-[12px] opacity-70">Ready for withdrawal</div>
            <button className="mt-4 rounded-lg bg-white/15 backdrop-blur px-3 py-1.5 text-[12px] font-medium hover:bg-white/25 transition">
              Withdraw funds
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <ArrowDownRight className="h-3 w-3 text-success" /> Incoming
          </div>
          <div className="mt-4 text-4xl font-display">
            $<Counter value={Math.round(stats.incomingCents / 100)} />
          </div>
          <div className="mt-1 text-[12px] text-success">+24.6% vs. last month</div>
          <div className="mt-4 h-16 -mx-2">
            <ResponsiveContainer>
              <AreaChart data={flow}>
                <defs>
                  <linearGradient id="pay" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="oklch(0.65 0.15 155)" stopOpacity={0.4} />
                    <stop offset="1" stopColor="oklch(0.65 0.15 155)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area dataKey="y" stroke="oklch(0.65 0.15 155)" strokeWidth={2} fill="url(#pay)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <ArrowUpRight className="h-3 w-3 text-destructive" /> Outgoing
          </div>
          <div className="mt-4 text-4xl font-display">
            $<Counter value={Math.round(stats.outgoingCents / 100)} />
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">Payouts, expenses, refunds</div>
          <div className="mt-4 h-16 -mx-2">
            <ResponsiveContainer>
              <AreaChart data={flow.map((d) => ({ ...d, y: d.y * 0.4 }))}>
                <defs>
                  <linearGradient id="out" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="oklch(0.58 0.28 295)" stopOpacity={0.4} />
                    <stop offset="1" stopColor="oklch(0.58 0.28 295)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area dataKey="y" stroke="oklch(0.58 0.28 295)" strokeWidth={2} fill="url(#out)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payment methods */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { i: Building2, l: "Primary Bank Account", s: "Primary" },
          { i: CreditCard, l: "Stripe · Card processing", s: "Active" },
          { i: Wallet, l: "Wise · Multi-currency", s: "Active" },
        ].map((m) => (
          <div
            key={m.l}
            className="rounded-2xl border border-border/70 bg-card/70 p-5 flex items-center gap-3 hover-lift"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet/10 text-violet">
              <m.i className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate">{m.l}</div>
              <div className="text-[11px] text-muted-foreground">{m.s}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
            Recent transactions
          </div>
          <button className="text-[12px] text-primary hover:underline">Export CSV</button>
        </div>
        <div className="divide-y divide-border/60">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading transaction ledger…
            </div>
          ) : errorMsg ? (
            <div className="flex items-center justify-center py-16 text-destructive text-[13px]">
              <AlertCircle className="h-4 w-4 mr-2" /> {errorMsg}
            </div>
          ) : paymentsList.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-[13px]">
              No transactions recorded in workspace.
            </div>
          ) : (
            paymentsList.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[minmax(0,1.5fr)_100px_120px_100px_120px] gap-3 items-center px-6 py-3.5 hover:bg-muted/40 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{t.clientName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">#{t.invoiceNumber}</div>
                  </div>
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {new Date(t.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div className="text-[12px] text-muted-foreground">{t.paymentMethod}</div>
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${toneMap[t.paymentMethod] || toneMap.Card}`}
                  >
                    Received
                  </span>
                </div>
                <div
                  className={`text-right text-[13.5px] font-medium tabular-nums ${t.amountCents < 0 ? "text-muted-foreground" : "text-success"}`}
                >
                  {t.amountCents < 0 ? "−" : "+"}${(Math.abs(t.amountCents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
