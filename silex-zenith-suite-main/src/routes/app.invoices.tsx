import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Search, Filter, Plus, MoreHorizontal, Loader2, AlertCircle } from "lucide-react";
import { getInvoicesFn } from "@/lib/server-functions/invoices";

export const Route = createFileRoute("/app/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — SILEX" },
      { name: "description", content: "Every invoice, calmly managed." },
    ],
  }),
  component: Invoices,
});

const toneMap: Record<string, string> = {
  Sent: "bg-primary/10 text-primary",
  Paid: "bg-success/10 text-success",
  Overdue: "bg-destructive/10 text-destructive",
  Draft: "bg-muted text-muted-foreground",
  "Partially Paid": "bg-violet/10 text-violet",
  Partially_paid: "bg-violet/10 text-violet",
};

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  status: string;
}

interface InvoiceStats {
  outstandingCents: number;
  outstandingCount: number;
  overdueCents: number;
  overdueCount: number;
  paidMonthCents: number;
  paidMonthCount: number;
  draftCents: number;
  draftCount: number;
}

function Invoices() {
  const [invoicesList, setInvoicesList] = useState<InvoiceItem[]>([]);
  const [stats, setStats] = useState<InvoiceStats>({
    outstandingCents: 0,
    outstandingCount: 0,
    overdueCents: 0,
    overdueCount: 0,
    paidMonthCents: 0,
    paidMonthCount: 0,
    draftCents: 0,
    draftCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("All");

  useEffect(() => {
    async function loadInvoices() {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        const res = await getInvoicesFn();
        if (res) {
          setInvoicesList(res.invoices);
          setStats(res.stats);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load invoices from database.");
      } finally {
        setIsLoading(false);
      }
    }

    loadInvoices();
  }, []);

  const filteredInvoices = invoicesList.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "All") return matchesSearch;
    return matchesSearch && inv.status.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Invoices</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Draft, send, and get paid.</p>
        </div>
        <Link
          to="/app/invoices/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
        >
          <Plus className="h-3.5 w-3.5" /> New invoice
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            l: "Outstanding",
            v: `$${(stats.outstandingCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            d: `${stats.outstandingCount} invoice${stats.outstandingCount === 1 ? "" : "s"}`,
          },
          {
            l: "Overdue",
            v: `$${(stats.overdueCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            d: `${stats.overdueCount} invoice${stats.overdueCount === 1 ? "" : "s"}`,
            tone: "destructive",
          },
          {
            l: "Paid this month",
            v: `$${(stats.paidMonthCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            d: `${stats.paidMonthCount} invoice${stats.paidMonthCount === 1 ? "" : "s"}`,
            tone: "success",
          },
          {
            l: "Draft",
            v: `$${(stats.draftCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            d: `${stats.draftCount} invoice${stats.draftCount === 1 ? "" : "s"}`,
          },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border/70 bg-card/70 p-5 hover-lift">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
            <div
              className={`mt-2 text-3xl font-display ${
                s.tone === "destructive" ? "text-destructive" : s.tone === "success" ? "text-success" : ""
              }`}
            >
              {s.v}
            </div>
            <div className="text-[12px] text-muted-foreground">{s.d}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 flex-1 min-w-[240px] focus-within:border-violet/60 transition">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoices, clients, amounts..."
            className="flex-1 bg-transparent outline-none text-[13px]"
          />
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px]">
          <Filter className="h-3.5 w-3.5" /> Filter
        </button>
        <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-0.5 text-[12px]">
          {["All", "Sent", "Paid", "Partially Paid", "Overdue", "Draft"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
        <div className="grid grid-cols-[120px_minmax(0,1.5fr)_120px_120px_120px_120px_40px] gap-3 px-5 py-3 border-b border-border/60 text-[11px] uppercase tracking-widest text-muted-foreground">
          <div>Invoice</div>
          <div>Client</div>
          <div>Issued</div>
          <div>Due</div>
          <div className="text-right">Amount</div>
          <div>Status</div>
          <div />
        </div>
        <div className="divide-y divide-border/60">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading invoices…
            </div>
          ) : errorMsg ? (
            <div className="flex items-center justify-center py-16 text-destructive text-[13px]">
              <AlertCircle className="h-4 w-4 mr-2" /> {errorMsg}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-[13px]">
              No invoices found in workspace.
            </div>
          ) : (
            filteredInvoices.map((i) => (
              <Link
                key={i.id}
                to="/app/invoices/$id"
                params={{ id: i.id }}
                className="grid grid-cols-[120px_minmax(0,1.5fr)_120px_120px_120px_120px_40px] items-center gap-3 px-5 py-4 hover:bg-muted/40 transition group"
              >
                <div className="font-mono text-[13px] font-medium">#{i.invoiceNumber}</div>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-[11px] font-semibold">
                    {i.clientName[0] || "C"}
                  </span>
                  <span className="truncate text-[13.5px]">{i.clientName}</span>
                </div>
                <div className="text-[12.5px] text-muted-foreground">
                  {new Date(i.issueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div className="text-[12.5px] text-muted-foreground">
                  {new Date(i.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div className="text-right text-[13.5px] font-medium tabular-nums">
                  ${(i.totalCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${toneMap[i.status] || toneMap.Sent}`}
                  >
                    {i.status}
                  </span>
                </div>
                <div className="flex justify-end opacity-0 group-hover:opacity-100 transition">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
