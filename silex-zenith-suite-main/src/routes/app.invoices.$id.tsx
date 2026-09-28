import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Download,
  Send,
  Printer,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { SilexLogo } from "@/components/silex/logo";
import {
  getInvoiceByIdFn,
  createPaymentFn,
  updateInvoiceStatusFn,
} from "@/lib/server-functions/invoices";
import { getWorkspaceSettingsFn } from "@/lib/server-functions/workspaces";

export const Route = createFileRoute("/app/invoices/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Invoice INV-${params.id} — SILEX` },
      { name: "description", content: `Invoice INV-${params.id}` },
    ],
  }),
  component: InvoicePreview,
});

interface InvoiceDetailData {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    currency: string;
    subtotalCents: number;
    taxCents: number;
    discountCents: number;
    totalCents: number;
    amountPaidCents: number;
    issueDate: string;
    dueDate: string;
    notes: string | null;
    terms: string | null;
  };
  client: {
    id: string;
    companyName: string;
    website: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  } | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    amountCents: number;
  }>;
}

interface WorkspaceSenderProfile {
  name: string;
  slug: string;
  taxId: string | null;
}

export function InvoicePreview() {
  const { id } = Route.useParams();
  const [data, setData] = useState<InvoiceDetailData | null>(null);
  const [workspaceProfile, setWorkspaceProfile] =
    useState<WorkspaceSenderProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDetail = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const [invRes, wsRes] = await Promise.all([
        getInvoiceByIdFn({ data: { invoiceId: id } }),
        getWorkspaceSettingsFn().catch(() => null),
      ]);

      if (invRes) {
        setData(invRes);
      } else {
        setErrorMsg("Invoice not found in authorized workspace.");
      }

      if (wsRes?.workspace) {
        setWorkspaceProfile({
          name: wsRes.workspace.name,
          slug: wsRes.workspace.slug,
          taxId: wsRes.settings?.taxId ?? null,
        });
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to load invoice details."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id && id !== "preview") {
      loadDetail();
    } else {
      setIsLoading(false);
    }
  }, [id]);

  const handlePayInvoice = async () => {
    if (!data) return;
    const remainingCents = data.invoice.totalCents - data.invoice.amountPaidCents;
    if (remainingCents <= 0) {
      toast.info("Invoice is already fully paid!");
      return;
    }

    try {
      setIsPaying(true);
      await createPaymentFn({
        data: {
          invoiceId: data.invoice.id,
          amountCents: remainingCents,
          paymentMethod: "Card",
          transactionReference: `ref_${Date.now()}`,
        },
      });
      toast.success(
        `Payment of $${(remainingCents / 100).toFixed(2)} recorded!`
      );
      await loadDetail();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to process payment."
      );
    } finally {
      setIsPaying(false);
    }
  };

  const handleSendToClient = async () => {
    if (!data) return;
    try {
      setIsSending(true);
      await updateInvoiceStatusFn({
        data: {
          invoiceId: data.invoice.id,
          status: "sent",
        },
      });
      toast.success(
        `Invoice #${data.invoice.invoiceNumber} marked as sent to client!`
      );
      await loadDetail();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update invoice status."
      );
    } finally {
      setIsSending(false);
    }
  };

  const invoiceNumber = data?.invoice.invoiceNumber || id;
  const clientName = data?.client?.companyName || "Client";
  const contactEmail = data?.client?.contactEmail || "";
  const totalDueCents = data
    ? Math.max(0, data.invoice.totalCents - data.invoice.amountPaidCents)
    : 0;
  const isPaid = data
    ? data.invoice.status === "paid" ||
      data.invoice.amountPaidCents >= data.invoice.totalCents
    : false;
  const isSent = data?.invoice.status === "sent";

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
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px] hover:border-violet/50 transition cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px] hover:border-violet/50 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
          <button
            onClick={handleSendToClient}
            disabled={isSending || isPaid || isSent}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isPaid ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : isSent ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {isPaid ? "Invoice Paid" : isSent ? "Sent to client" : "Send to client"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-[13px]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading invoice details…
        </div>
      ) : errorMsg ? (
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <div className="text-base font-medium">{errorMsg}</div>
          <Link
            to="/app/invoices"
            className="inline-block text-[13px] text-primary underline"
          >
            Return to Invoices List
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl bg-card shadow-float-lg overflow-hidden border border-border/60">
            {/* Header ribbon */}
            <div className="relative bg-primary text-primary-foreground p-8">
              <div className="absolute inset-0 bg-mesh-dark opacity-70" />
              <div className="relative flex flex-wrap items-start justify-between gap-6">
                <SilexLogo className="text-primary-foreground [&_span]:!text-primary-foreground" />
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[11px] uppercase tracking-widest opacity-70">
                      Invoice
                    </span>
                    {data?.invoice.status && (
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-white/20 text-primary-foreground">
                        {data.invoice.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-3xl font-display">#{invoiceNumber}</div>
                  <div className="mt-1 text-[12px] opacity-70">
                    Issued{" "}
                    {data
                      ? new Date(data.invoice.issueDate).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )
                      : "Sep 24"}{" "}
                    · Due{" "}
                    {data
                      ? new Date(data.invoice.dueDate).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )
                      : "Oct 8, 2026"}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    From
                  </div>
                  <div className="mt-1 text-[14px] font-medium">
                    {workspaceProfile?.name || "Workspace Business"}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">
                    {`billing@${workspaceProfile?.slug || "workspace"}.co`}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">
                    {workspaceProfile?.taxId
                      ? `Tax ID: ${workspaceProfile.taxId}`
                      : "Operating Business Account"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Bill to
                  </div>
                  <div className="mt-1 text-[14px] font-medium">{clientName}</div>
                  <div className="text-[12.5px] text-muted-foreground">
                    {contactEmail}
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <div className="grid grid-cols-[minmax(0,1fr)_60px_80px_100px] gap-3 pb-2 border-b border-border text-[11px] uppercase tracking-widest text-muted-foreground">
                  <div>Description</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Rate</div>
                  <div className="text-right">Amount</div>
                </div>
                <div className="divide-y divide-border/60 text-[13.5px]">
                  {data?.items && data.items.length > 0
                    ? data.items.map((r) => (
                        <div
                          key={r.id}
                          className="grid grid-cols-[minmax(0,1fr)_60px_80px_100px] gap-3 py-3"
                        >
                          <div>{r.description}</div>
                          <div className="text-right tabular-nums">
                            {r.quantity}
                          </div>
                          <div className="text-right tabular-nums text-muted-foreground">
                            ${(r.unitPriceCents / 100).toFixed(2)}
                          </div>
                          <div className="text-right tabular-nums font-medium">
                            $
                            {(r.amountCents / 100).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      ))
                    : (
                      <div className="py-8 text-center text-muted-foreground text-xs">
                        No line items recorded for this invoice.
                      </div>
                    )}
                </div>
              </div>

              <div className="mt-6 ml-auto max-w-xs text-[13.5px] space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    $
                    {(
                      (data?.invoice.subtotalCents || 0) / 100
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {Boolean(data?.invoice.discountCents && data.invoice.discountCents > 0) && (
                  <div className="flex justify-between text-success">
                    <span>Discount</span>
                    <span className="tabular-nums">
                      -$
                      {(
                        (data?.invoice.discountCents || 0) / 100
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="tabular-nums">
                    $
                    {(
                      (data?.invoice.taxCents || 0) / 100
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {Boolean(data?.invoice.amountPaidCents && data.invoice.amountPaidCents > 0 && !isPaid) && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount paid</span>
                    <span className="tabular-nums">
                      -$
                      {(
                        (data?.invoice.amountPaidCents || 0) / 100
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                <div className="h-px bg-border" />
                <div className="flex justify-between text-lg font-display">
                  <span>Total due</span>
                  <span className="tabular-nums">
                    $
                    {(totalDueCents / 100).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div className="mt-10 rounded-2xl bg-muted/50 p-5 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-success/15 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="text-[13px] font-medium">
                    {isPaid ? "Invoice Paid" : "Pay in one click"}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {isPaid
                      ? "This invoice has been fully settled and recorded in payments ledger."
                      : "Card, bank, or ACH — settled to your account within 2 business days."}
                  </div>
                </div>
                {!isPaid && (
                  <button
                    onClick={handlePayInvoice}
                    disabled={isPaying}
                    className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-[12px] font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
                  >
                    {isPaying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      `Pay $${(totalDueCents / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    )}
                  </button>
                )}
              </div>

              <div className="mt-10 pt-6 border-t border-border text-[12px] text-muted-foreground text-center">
                {data?.invoice.notes || "Thank you for the trust."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
