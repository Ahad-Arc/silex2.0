import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  Check,
  AlertCircle,
  ShieldAlert,
  Hash,
  Globe,
  Coins,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getWorkspaceSettingsFn,
  updateWorkspaceSettingsFn,
} from "@/lib/server-functions/workspaces";
import { cn } from "@/lib/utils";

export function WorkspaceTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>("member");

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [invoiceNextNumber, setInvoiceNextNumber] = useState<number>(1001);
  const [taxId, setTaxId] = useState("");
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState<number>(1);

  // Load active workspace settings
  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await getWorkspaceSettingsFn({});
      if (res?.workspace) {
        setName(res.workspace.name || "");
        setSlug(res.workspace.slug || "");
        setUserRole(res.userRole || "member");
      }
      if (res?.settings) {
        setDefaultCurrency(res.settings.defaultCurrency || "USD");
        setInvoicePrefix(res.settings.invoicePrefix || "INV-");
        setInvoiceNextNumber(res.settings.invoiceNextNumber ?? 1001);
        setTaxId(res.settings.taxId || "");
        setFiscalYearStartMonth(res.settings.fiscalYearStartMonth ?? 1);
      }
    } catch (err: any) {
      toast.error("Failed to load workspace settings", {
        description: err?.message || "Please refresh and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const canEdit = userRole === "admin" || userRole === "owner";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error("Permission denied", {
        description: "Only workspace administrators and owners can update workspace settings.",
      });
      return;
    }

    if (!name.trim()) {
      toast.error("Validation Error", { description: "Workspace name cannot be empty." });
      return;
    }

    if (slug.trim() && !/^[a-z0-9-]+$/.test(slug.trim())) {
      toast.error("Validation Error", {
        description: "Slug must contain only lowercase letters, numbers, and hyphens.",
      });
      return;
    }

    if (!/^[A-Z]{3}$/.test(defaultCurrency.trim())) {
      toast.error("Validation Error", {
        description: "Currency must be a valid 3-letter uppercase code (e.g. USD, EUR, GBP).",
      });
      return;
    }

    if (invoiceNextNumber < 1) {
      toast.error("Validation Error", {
        description: "Next invoice number must be a positive integer.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateWorkspaceSettingsFn({
        data: {
          name: name.trim(),
          slug: slug.trim() || undefined,
          defaultCurrency: defaultCurrency.trim().toUpperCase(),
          invoicePrefix: invoicePrefix.trim() || "INV-",
          invoiceNextNumber: Number(invoiceNextNumber),
          taxId: taxId.trim() || null,
          fiscalYearStartMonth: Number(fiscalYearStartMonth),
        },
      });

      toast.success("Settings saved", {
        description: "Workspace configuration updated successfully.",
      });

      // Dispatch event to synchronize AppShell workspace switcher live
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("silex_workspace_updated", {
            detail: {
              name: updated.workspace.name,
              planTier: updated.workspace.planTier,
              logoUrl: updated.workspace.logoUrl,
            },
          }),
        );
      }
    } catch (err: any) {
      toast.error("Save failed", {
        description: err?.message || "An unexpected error occurred while saving.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/70 p-8 flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-violet" />
        <p className="text-[13px] text-muted-foreground">Loading workspace settings…</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-6 space-y-6">
      <div className="border-b border-border/60 pb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-display">Workspace Details</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Configure how your workspace operates, formats invoices, and displays to clients.
          </p>
        </div>
        {!canEdit && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] font-medium">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>Read-only (Member)</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Workspace Name */}
        <div className="grid md:grid-cols-[220px_1fr] items-center gap-3">
          <div>
            <div className="text-[13px] font-medium">Workspace Name</div>
            <div className="text-[11.5px] text-muted-foreground">The display name of your organization.</div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit || isSaving}
              placeholder="e.g. Acme Studio"
              className="flex-1 bg-transparent outline-none text-[13px] min-w-0 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Workspace Slug */}
        <div className="grid md:grid-cols-[220px_1fr] items-center gap-3">
          <div>
            <div className="text-[13px] font-medium">Workspace URL</div>
            <div className="text-[11.5px] text-muted-foreground">Unique identifier used in URLs.</div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-[12px] font-mono text-muted-foreground">silex.app/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!canEdit || isSaving}
              placeholder="acme-studio"
              className="flex-1 bg-transparent outline-none text-[13px] font-mono min-w-0 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Currency & Financials */}
        <div className="grid md:grid-cols-[220px_1fr] items-center gap-3">
          <div>
            <div className="text-[13px] font-medium">Default Currency</div>
            <div className="text-[11.5px] text-muted-foreground">3-letter ISO code for pricing.</div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
            <Coins className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
              disabled={!canEdit || isSaving}
              maxLength={3}
              placeholder="USD"
              className="flex-1 bg-transparent outline-none text-[13px] font-mono uppercase min-w-0 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Invoice Prefix & Numbering */}
        <div className="grid md:grid-cols-[220px_1fr] items-center gap-3">
          <div>
            <div className="text-[13px] font-medium">Invoice Numbering</div>
            <div className="text-[11.5px] text-muted-foreground">Prefix and starting sequence number.</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Prefix:</span>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                disabled={!canEdit || isSaving}
                maxLength={20}
                placeholder="INV-"
                className="flex-1 bg-transparent outline-none text-[13px] font-mono min-w-0 disabled:opacity-60"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="number"
                value={invoiceNextNumber}
                onChange={(e) => setInvoiceNextNumber(parseInt(e.target.value) || 1)}
                disabled={!canEdit || isSaving}
                min={1}
                className="flex-1 bg-transparent outline-none text-[13px] font-mono min-w-0 disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Tax ID / VAT */}
        <div className="grid md:grid-cols-[220px_1fr] items-center gap-3">
          <div>
            <div className="text-[13px] font-medium">Tax ID / VAT</div>
            <div className="text-[11.5px] text-muted-foreground">Appears on client invoices and receipts.</div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              disabled={!canEdit || isSaving}
              maxLength={100}
              placeholder="e.g. US-123456789 or GB-987654321"
              className="flex-1 bg-transparent outline-none text-[13px] min-w-0 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Fiscal Year Start Month */}
        <div className="grid md:grid-cols-[220px_1fr] items-center gap-3">
          <div>
            <div className="text-[13px] font-medium">Fiscal Year Start</div>
            <div className="text-[11.5px] text-muted-foreground">Month when your financial calendar begins.</div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={fiscalYearStartMonth}
              onChange={(e) => setFiscalYearStartMonth(Number(e.target.value))}
              disabled={!canEdit || isSaving}
              className="flex-1 bg-transparent outline-none text-[13px] cursor-pointer disabled:opacity-60"
            >
              {[
                { m: 1, n: "January" },
                { m: 2, n: "February" },
                { m: 3, n: "March" },
                { m: 4, n: "April" },
                { m: 5, n: "May" },
                { m: 6, n: "June" },
                { m: 7, n: "July" },
                { m: 8, n: "August" },
                { m: 9, n: "September" },
                { m: 10, n: "October" },
                { m: 11, n: "November" },
                { m: 12, n: "December" },
              ].map(({ m, n }) => (
                <option key={m} value={m} className="bg-popover text-popover-foreground">
                  {n} (Month {m})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button */}
        {canEdit && (
          <div className="pt-4 border-t border-border/50 flex justify-end">
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl px-5 py-2 text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Changes…
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
