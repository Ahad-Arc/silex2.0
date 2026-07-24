import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Send, Printer, CheckCircle2 } from "lucide-react";
import { SilexLogo } from "@/components/silex/logo";

export const Route = createFileRoute("/app/invoices/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Invoice INV-${params.id} — SILEX` }, { name: "description", content: `Invoice INV-${params.id}` }],
  }),
  component: InvoicePreview,
});

function InvoicePreview() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-6 stagger">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/invoices" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Invoices
        </Link>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px] hover:border-violet/50 transition"><Printer className="h-3.5 w-3.5" /> Print</button>
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px] hover:border-violet/50 transition"><Download className="h-3.5 w-3.5" /> PDF</button>
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"><Send className="h-3.5 w-3.5" /> Send to client</button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-card shadow-float-lg overflow-hidden">
          {/* Header ribbon */}
          <div className="relative bg-primary text-primary-foreground p-8">
            <div className="absolute inset-0 bg-mesh-dark opacity-70" />
            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <SilexLogo className="text-primary-foreground [&_span]:!text-primary-foreground" />
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-widest opacity-70">Invoice</div>
                <div className="mt-1 text-3xl font-display">#INV-{id}</div>
                <div className="mt-1 text-[12px] opacity-70">Issued Sep 24 · Due Oct 8, 2026</div>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">From</div>
                <div className="mt-1 text-[14px] font-medium">Ariana Studio</div>
                <div className="text-[12.5px] text-muted-foreground">ariana@studio.co</div>
                <div className="text-[12.5px] text-muted-foreground">140 Wythe Ave, Brooklyn, NY 11249</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Bill to</div>
                <div className="mt-1 text-[14px] font-medium">Acme Studio</div>
                <div className="text-[12.5px] text-muted-foreground">ellie@acme.co</div>
                <div className="text-[12.5px] text-muted-foreground">Portland, OR</div>
              </div>
            </div>

            <div className="mt-8">
              <div className="grid grid-cols-[minmax(0,1fr)_60px_80px_100px] gap-3 pb-2 border-b border-border text-[11px] uppercase tracking-widest text-muted-foreground">
                <div>Description</div><div className="text-right">Qty</div><div className="text-right">Rate</div><div className="text-right">Amount</div>
              </div>
              <div className="divide-y divide-border/60 text-[13.5px]">
                {[
                  { d: "Q3 brand system refresh", q: 42, r: 185 },
                  { d: "Licensing bundle — team of 12", q: 1, r: 1200 },
                  { d: "Project management", q: 1, r: 600 },
                ].map((r, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_60px_80px_100px] gap-3 py-3">
                    <div>{r.d}</div>
                    <div className="text-right tabular-nums">{r.q}</div>
                    <div className="text-right tabular-nums text-muted-foreground">${r.r}</div>
                    <div className="text-right tabular-nums font-medium">${(r.q * r.r).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 ml-auto max-w-xs text-[13.5px] space-y-2">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">$9,570</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Tax (8.75%)</span><span className="tabular-nums">$837.38</span></div>
              <div className="h-px bg-border" />
              <div className="flex justify-between text-lg font-display"><span>Total due</span><span className="tabular-nums">$10,407.38</span></div>
            </div>

            <div className="mt-10 rounded-2xl bg-muted/50 p-5 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-success/15 text-success"><CheckCircle2 className="h-4 w-4" /></span>
              <div className="flex-1">
                <div className="text-[13px] font-medium">Pay in one click</div>
                <div className="text-[12px] text-muted-foreground">Card, bank, or ACH — settled to your account within 2 business days.</div>
              </div>
              <button className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-[12px] font-medium hover:bg-primary/90">Pay $10,407.38</button>
            </div>

            <div className="mt-10 pt-6 border-t border-border text-[12px] text-muted-foreground text-center">
              Thank you for the trust. — Ariana
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
