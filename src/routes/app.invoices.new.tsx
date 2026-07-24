import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Sparkles, Send, Eye } from "lucide-react";

export const Route = createFileRoute("/app/invoices/new")({
  head: () => ({ meta: [{ title: "New invoice — SILEX" }, { name: "description", content: "Draft a new invoice." }] }),
  component: InvoiceBuilder,
});

type Item = { id: string; desc: string; qty: number; rate: number };

function InvoiceBuilder() {
  const [items, setItems] = useState<Item[]>([
    { id: "1", desc: "Q3 brand system refresh", qty: 42, rate: 185 },
    { id: "2", desc: "Licensing bundle — team of 12", qty: 1, rate: 1200 },
  ]);

  const addItem = () => setItems([...items, { id: crypto.randomUUID(), desc: "", qty: 1, rate: 0 }]);
  const updateItem = (id: string, patch: Partial<Item>) => setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id));

  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const tax = subtotal * 0.0875;
  const total = subtotal + tax;

  return (
    <div className="space-y-6 stagger">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/invoices" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Invoices
        </Link>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px] hover:border-violet/50 transition">
            <Sparkles className="h-3.5 w-3.5 text-violet" /> Draft with AI
          </button>
          <Link to="/app/invoices/$id" params={{ id: "preview" }} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px] hover:border-violet/50 transition">
            <Eye className="h-3.5 w-3.5" /> Preview
          </Link>
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition">
            <Send className="h-3.5 w-3.5" /> Send
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-border/70 bg-card/80 p-8 shadow-float">
          {/* Head */}
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Invoice</div>
              <div className="mt-1 text-3xl font-display">INV-2042</div>
              <div className="mt-3 text-[12px] text-muted-foreground">
                Issued <span className="text-foreground">Sep 24, 2026</span> · Due <span className="text-foreground">Oct 8, 2026</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">From</div>
              <div className="mt-1 text-[14px] font-medium">Ariana Studio</div>
              <div className="text-[12.5px] text-muted-foreground">ariana@studio.co</div>
              <div className="text-[12.5px] text-muted-foreground">Brooklyn, NY</div>
            </div>
          </div>

          {/* Bill to */}
          <div className="mt-8 rounded-2xl border border-dashed border-border p-4">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Bill to</div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <input placeholder="Client name" defaultValue="Acme Studio" className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60" />
              <input placeholder="Email" defaultValue="ellie@acme.co" className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60" />
              <input placeholder="Address" defaultValue="140 Wythe Ave, Brooklyn, NY" className="md:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60" />
            </div>
          </div>

          {/* Items */}
          <div className="mt-8">
            <div className="grid grid-cols-[minmax(0,1fr)_80px_100px_100px_36px] gap-3 pb-2 border-b border-border/60 text-[11px] uppercase tracking-widest text-muted-foreground">
              <div>Description</div><div className="text-right">Qty</div><div className="text-right">Rate</div><div className="text-right">Amount</div><div />
            </div>
            <div className="divide-y divide-border/60">
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-[minmax(0,1fr)_80px_100px_100px_36px] gap-3 py-3 items-center">
                  <input value={it.desc} onChange={(e) => updateItem(it.id, { desc: e.target.value })} className="rounded-lg bg-transparent px-2 py-1.5 text-[13.5px] outline-none focus:bg-muted/40" placeholder="Line item" />
                  <input type="number" value={it.qty} onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })} className="rounded-lg bg-transparent px-2 py-1.5 text-right text-[13.5px] tabular-nums outline-none focus:bg-muted/40" />
                  <input type="number" value={it.rate} onChange={(e) => updateItem(it.id, { rate: Number(e.target.value) })} className="rounded-lg bg-transparent px-2 py-1.5 text-right text-[13.5px] tabular-nums outline-none focus:bg-muted/40" />
                  <div className="text-right text-[13.5px] font-medium tabular-nums">${(it.qty * it.rate).toLocaleString()}</div>
                  <button onClick={() => removeItem(it.id)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-3 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] text-primary hover:underline">
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
              <span className="tabular-nums">${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Notes</div>
            <textarea rows={3} defaultValue="Thank you for the trust. Payable via bank transfer or card link. Net-14 terms." className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60" />
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-violet text-primary-foreground p-5 shadow-float">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest opacity-80">
              <Sparkles className="h-3 w-3" /> SILEX AI
            </div>
            <p className="mt-3 text-[13px] leading-relaxed opacity-95">
              Based on Acme's last 3 invoices, I'd suggest adding a $600 project management line. Add it?
            </p>
            <button className="mt-4 rounded-lg bg-white/15 backdrop-blur px-3 py-1.5 text-[12px] font-medium hover:bg-white/25 transition">
              Add line item
            </button>
          </div>

          <div className="rounded-3xl border border-border/70 bg-card/70 p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Settings</div>
            <SidebarField label="Currency" value="USD" />
            <SidebarField label="Terms" value="Net-14" />
            <SidebarField label="Payment link" value="Stripe · enabled" />
            <SidebarField label="Late fee" value="1.5% / month" />
            <SidebarField label="PO number" value="—" />
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
      <span className="tabular-nums">${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
    </div>
  );
}

function SidebarField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <button className="rounded-md px-1.5 py-0.5 hover:bg-muted transition">{value}</button>
    </div>
  );
}
