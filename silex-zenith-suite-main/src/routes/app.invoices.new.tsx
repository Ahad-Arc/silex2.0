import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, Sparkles, Send, Eye, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { getClientsFn } from "@/lib/server-functions/crm";
import { createInvoiceFn } from "@/lib/server-functions/invoices";

export const Route = createFileRoute("/app/invoices/new")({
  head: () => ({
    meta: [
      { title: "New invoice — SILEX" },
      { name: "description", content: "Draft a new invoice." },
    ],
  }),
  component: InvoiceBuilder,
});

type Item = { id: string; desc: string; qty: number; rate: number };

interface ClientOption {
  id: string;
  companyName: string;
}

function InvoiceBuilder() {
  const navigate = useNavigate();
  const [clientsList, setClientsList] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isLoadingClients, setIsLoadingClients] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [currency, setCurrency] = useState<string>("USD");
  const [terms, setTerms] = useState<string>("Net-14");
  const [notes, setNotes] = useState<string>("Thank you for the trust. Payable via bank transfer or card link. Net-14 terms.");

  const [items, setItems] = useState<Item[]>([
    { id: "1", desc: "Q3 brand system refresh", qty: 42, rate: 185 },
    { id: "2", desc: "Licensing bundle — team of 12", qty: 1, rate: 1200 },
  ]);

  useEffect(() => {
    async function loadClients() {
      try {
        setIsLoadingClients(true);
        const res = await getClientsFn();
        if (res && res.length > 0) {
          setClientsList(res.map((c) => ({ id: c.id, companyName: c.companyName })));
          setSelectedClientId(res[0].id);
        }
      } catch {
        // Handled silently
      } finally {
        setIsLoadingClients(false);
      }
    }

    loadClients();
  }, []);

  const addItem = () =>
    setItems([...items, { id: crypto.randomUUID(), desc: "", qty: 1, rate: 0 }]);
  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id));

  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const tax = subtotal * 0.0875;
  const total = subtotal + tax;

  const handleCreateInvoice = async () => {
    if (!selectedClientId) {
      toast.error("Please select a client for this invoice.");
      return;
    }

    const validItems = items.filter((i) => i.desc.trim().length > 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one line item with a description.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        clientId: selectedClientId,
        issueDate,
        dueDate,
        currency,
        notes,
        terms,
        taxCents: Math.round(tax * 100),
        discountCents: 0,
        items: validItems.map((it) => ({
          description: it.desc.trim(),
          quantity: Number(it.qty) || 1,
          unitPriceCents: Math.round(it.rate * 100),
        })),
      };

      const created = await createInvoiceFn({ data: payload });
      toast.success(`Invoice #${created.invoiceNumber} created successfully!`);
      navigate({ to: "/app/invoices" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 stagger">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/invoices"
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Invoices
        </Link>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px] hover:border-violet/50 transition">
            <Sparkles className="h-3.5 w-3.5 text-violet" /> Draft with AI
          </button>
          <Link
            to="/app/invoices"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px] hover:border-violet/50 transition"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </Link>
          <button
            onClick={handleCreateInvoice}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Save & Send
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-border/70 bg-card/80 p-8 shadow-float">
          {/* Head */}
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Invoice
              </div>
              <div className="mt-1 text-3xl font-display">Auto-numbered</div>
              <div className="mt-3 flex items-center gap-3 text-[12px] text-muted-foreground">
                <span>
                  Issued:{" "}
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="rounded bg-transparent text-foreground outline-none border border-border/50 px-1 py-0.5"
                  />
                </span>
                <span>
                  Due:{" "}
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="rounded bg-transparent text-foreground outline-none border border-border/50 px-1 py-0.5"
                  />
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                From
              </div>
              <div className="mt-1 text-[14px] font-medium">Workspace Business</div>
              <div className="text-[12.5px] text-muted-foreground">billing@workspace.co</div>
            </div>
          </div>

          {/* Bill to */}
          <div className="mt-8 rounded-2xl border border-dashed border-border p-4">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
              Bill to Client *
            </div>
            {isLoadingClients ? (
              <div className="flex items-center text-muted-foreground text-[13px] py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Loading clients…
              </div>
            ) : clientsList.length > 0 ? (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60"
              >
                {clientsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-[13px] text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-violet" />
                No clients found in workspace. Please create a client in{" "}
                <Link to="/app/clients" className="text-primary underline">
                  Clients
                </Link>{" "}
                first.
              </div>
            )}
          </div>

          {/* Items */}
          <div className="mt-8">
            <div className="grid grid-cols-[minmax(0,1fr)_80px_100px_100px_36px] gap-3 pb-2 border-b border-border/60 text-[11px] uppercase tracking-widest text-muted-foreground">
              <div>Description</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Rate ($)</div>
              <div className="text-right">Amount</div>
              <div />
            </div>
            <div className="divide-y divide-border/60">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-[minmax(0,1fr)_80px_100px_100px_36px] gap-3 py-3 items-center"
                >
                  <input
                    value={it.desc}
                    onChange={(e) => updateItem(it.id, { desc: e.target.value })}
                    className="rounded-lg bg-transparent px-2 py-1.5 text-[13.5px] outline-none focus:bg-muted/40"
                    placeholder="Line item description"
                  />
                  <input
                    type="number"
                    value={it.qty}
                    onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })}
                    className="rounded-lg bg-transparent px-2 py-1.5 text-right text-[13.5px] tabular-nums outline-none focus:bg-muted/40"
                  />
                  <input
                    type="number"
                    value={it.rate}
                    onChange={(e) => updateItem(it.id, { rate: Number(e.target.value) })}
                    className="rounded-lg bg-transparent px-2 py-1.5 text-right text-[13.5px] tabular-nums outline-none focus:bg-muted/40"
                  />
                  <div className="text-right text-[13.5px] font-medium tabular-nums">
                    ${(it.qty * it.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <button
                    onClick={() => removeItem(it.id)}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add line item
            </button>
          </div>

          {/* Totals */}
          <div className="mt-8 ml-auto max-w-xs space-y-2 text-[13.5px]">
            <Row label="Subtotal" value={subtotal} />
            <Row label="Tax (8.75%)" value={tax} muted />
            <div className="h-px bg-border" />
            <div className="flex justify-between font-medium text-lg font-display">
              <span>Total</span>
              <span className="tabular-nums">
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Notes</div>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60"
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-violet text-primary-foreground p-5 shadow-float">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest opacity-80">
              <Sparkles className="h-3 w-3" /> SILEX AI
            </div>
            <p className="mt-3 text-[13px] leading-relaxed opacity-95">
              Invoice numbers are automatically incremented and secured by your workspace settings.
            </p>
          </div>

          <div className="rounded-3xl border border-border/70 bg-card/70 p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Settings
            </div>
            <SidebarField label="Currency" value={currency} />
            <SidebarField label="Terms" value={terms} />
            <SidebarField label="Late fee" value="1.5% / month" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">
        ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function SidebarField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="rounded-md px-1.5 py-0.5 font-medium">{value}</span>
    </div>
  );
}
