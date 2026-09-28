import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useTransition } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Building2,
  Wallet,
  Loader2,
  AlertCircle,
  Receipt,
  Plus,
  Trash2,
  ExternalLink,
  Tag,
  FolderKanban,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { Counter } from "@/components/silex/counter";
import { Button } from "@/components/ui/button";
import { getPaymentsFn } from "@/lib/server-functions/invoices";
import { deleteExpenseFn } from "@/lib/server-functions/expenses";
import { RecordExpenseModal } from "@/components/silex/finance/record-expense-modal";

export const Route = createFileRoute("/app/payments")({
  head: () => ({
    meta: [
      { title: "Payments & Expenses — SILEX" },
      { name: "description", content: "Payments, expenses, cashflow and transactions ledger." },
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
  type?: "payment" | "expense";
  category?: string;
  projectName?: string | null;
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
  expense: "bg-destructive/10 text-destructive",
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
  const [filterTab, setFilterTab] = useState<"all" | "incoming" | "outgoing">("all");
  const [isRecordExpenseOpen, setIsRecordExpenseOpen] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await getPaymentsFn();
      if (res) {
        setPaymentsList(res.payments as PaymentItem[]);
        setStats(res.stats);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load payments ledger.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleDeleteExpense = async (expenseId: string, label: string) => {
    if (!confirm(`Are you sure you want to delete the expense for "${label}"?`)) {
      return;
    }

    try {
      setIsDeletingId(expenseId);
      await deleteExpenseFn({
        data: { expenseId },
      });
      toast.success("Expense deleted successfully.");
      await loadPayments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense.");
    } finally {
      setIsDeletingId(null);
    }
  };

  // Filter transactions
  const filteredList = paymentsList.filter((item) => {
    if (filterTab === "incoming") {
      return item.amountCents > 0 && item.type !== "expense";
    }
    if (filterTab === "outgoing") {
      return item.amountCents < 0 || item.type === "expense";
    }
    return true;
  });

  const incomingCount = paymentsList.filter(
    (item) => item.amountCents > 0 && item.type !== "expense"
  ).length;
  const outgoingCount = paymentsList.filter(
    (item) => item.amountCents < 0 || item.type === "expense"
  ).length;

  return (
    <div className="space-y-6 stagger">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Payments & Expenses</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Money in, money out, all in one calm unified view.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setIsRecordExpenseOpen(true)}
            size="sm"
            className="rounded-xl h-9 bg-primary text-primary-foreground text-xs font-medium shadow-float hover:bg-primary/90 flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Record expense
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Cash Available */}
        <div className="rounded-3xl bg-primary text-primary-foreground p-6 relative overflow-hidden shadow-float">
          <div className="absolute inset-0 bg-mesh-dark opacity-70" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest opacity-80">
              <Wallet className="h-3 w-3" /> Net cash available
            </div>
            <div className="mt-4 text-5xl font-display">
              $<Counter value={Math.round(stats.cashAvailableCents / 100)} />
            </div>
            <div className="mt-1 text-[12px] opacity-70">
              Incoming − Outgoing operating balance
            </div>
          </div>
        </div>

        {/* Incoming */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <ArrowDownRight className="h-3 w-3 text-success" /> Incoming received
          </div>
          <div className="mt-4 text-4xl font-display text-success">
            $<Counter value={Math.round(stats.incomingCents / 100)} />
          </div>
          <div className="mt-1 text-[12px] text-success">
            {incomingCount} client payment{incomingCount === 1 ? "" : "s"} collected
          </div>
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

        {/* Outgoing */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <ArrowUpRight className="h-3 w-3 text-destructive" /> Outgoing expenses
          </div>
          <div className="mt-4 text-4xl font-display text-foreground">
            $<Counter value={Math.round(stats.outgoingCents / 100)} />
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {outgoingCount} operational cost{outgoingCount === 1 ? "" : "s"} recorded
          </div>
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

      {/* Payment methods & accounts */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { i: Building2, l: "Primary Bank Account", s: "Operational Account" },
          { i: CreditCard, l: "Card & Client Processing", s: "Active Gateway" },
          { i: Wallet, l: "Multi-Currency Ledger", s: "USD Default" },
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

      {/* Transactions & Ledger */}
      <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground font-medium">
              Transactions Ledger
            </div>
            {/* Filter Tabs */}
            <div className="flex items-center rounded-xl bg-muted/40 p-0.5 border border-border/60 text-xs">
              <button
                onClick={() => setFilterTab("all")}
                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                  filterTab === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({paymentsList.length})
              </button>
              <button
                onClick={() => setFilterTab("incoming")}
                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                  filterTab === "incoming"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Incoming ({incomingCount})
              </button>
              <button
                onClick={() => setFilterTab("outgoing")}
                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                  filterTab === "outgoing"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Outgoing ({outgoingCount})
              </button>
            </div>
          </div>
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
          ) : filteredList.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-[13px]">
              {filterTab === "all"
                ? "No transactions recorded in workspace."
                : `No ${filterTab} transactions found.`}
            </div>
          ) : (
            filteredList.map((t) => {
              const isExpense = t.type === "expense" || t.amountCents < 0;

              return (
                <div
                  key={t.id}
                  className="grid grid-cols-[minmax(0,1.8fr)_100px_130px_110px_120px_40px] gap-3 items-center px-6 py-3.5 hover:bg-muted/40 transition group"
                >
                  {/* Entity Details */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-lg ${
                        isExpense ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                      }`}
                    >
                      {isExpense ? (
                        <Receipt className="h-3.5 w-3.5" />
                      ) : (
                        <CreditCard className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium flex items-center gap-1.5">
                        <span className="truncate">{t.clientName}</span>
                        {t.projectName && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.2 rounded shrink-0">
                            <FolderKanban className="h-2.5 w-2.5" />
                            {t.projectName}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate flex items-center gap-1.5">
                        {isExpense ? (
                          <>
                            <span className="inline-flex items-center gap-0.5">
                              <Tag className="h-2.5 w-2.5 opacity-70" />
                              {t.category || t.invoiceNumber}
                            </span>
                            {t.transactionReference && (
                              <span className="opacity-70 truncate max-w-[120px]">
                                · {t.transactionReference}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span>Invoice #{t.invoiceNumber}</span>
                            {t.transactionReference && (
                              <span className="opacity-70 truncate max-w-[120px]">
                                · {t.transactionReference}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-[12px] text-muted-foreground">
                    {new Date(t.paidAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>

                  {/* Channel / Category */}
                  <div className="text-[12px] text-muted-foreground truncate">
                    {isExpense ? t.category || "Expense" : t.paymentMethod}
                  </div>

                  {/* Status Badge */}
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isExpense
                          ? "bg-destructive/10 text-destructive"
                          : toneMap[t.paymentMethod] || toneMap.Card
                      }`}
                    >
                      {isExpense ? "Expense" : "Received"}
                    </span>
                  </div>

                  {/* Amount Tabular */}
                  <div
                    className={`text-right text-[13.5px] font-medium tabular-nums ${
                      isExpense ? "text-foreground font-mono" : "text-success font-mono"
                    }`}
                  >
                    {isExpense ? "−" : "+"}$
                    {(Math.abs(t.amountCents) / 100).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end">
                    {isExpense ? (
                      <button
                        onClick={() => handleDeleteExpense(t.id, t.clientName)}
                        disabled={isDeletingId === t.id}
                        title="Delete expense"
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground p-1 transition rounded-lg hover:bg-muted"
                      >
                        {isDeletingId === t.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : (
                      <span className="w-3.5" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Record Expense Modal */}
      <RecordExpenseModal
        open={isRecordExpenseOpen}
        onOpenChange={setIsRecordExpenseOpen}
        onExpenseRecorded={loadPayments}
      />
    </div>
  );
}
