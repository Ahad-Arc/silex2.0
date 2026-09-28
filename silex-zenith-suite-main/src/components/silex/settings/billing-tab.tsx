import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Sparkles,
  Check,
  AlertCircle,
  ShieldCheck,
  Clock,
  ArrowRight,
  Loader2,
  Calendar,
  Users,
  FolderKanban,
  FileText,
  Building,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getBillingOverviewFn,
  createCheckoutSessionFn,
  cancelSubscriptionFn,
  resumeSubscriptionFn,
  type PlanTierConfig,
} from "@/lib/server-functions/billing";
import { cn } from "@/lib/utils";

interface BillingOverviewData {
  workspace: {
    id: string;
    name: string;
    slug: string;
    planTier: string;
  };
  memberRole: string;
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    updatedAt: string;
  } | null;
  usage: {
    invoicesCount: number;
    clientsCount: number;
    projectsCount: number;
    membersCount: number;
  };
  currentPlan: PlanTierConfig;
  plans: PlanTierConfig[];
}

export function BillingTab() {
  const [data, setData] = useState<BillingOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Upgrade Dialog state
  const [selectedPlan, setSelectedPlan] = useState<PlanTierConfig | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  // Cancellation Alert state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Load billing & subscription overview
  const loadBillingData = async () => {
    setIsLoading(true);
    try {
      const res = await getBillingOverviewFn();
      if (res) {
        setData(res);
      }
    } catch (err: any) {
      toast.error("Failed to load billing information", {
        description: err?.message || "Please refresh the page and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, []);

  const isAdminOrOwner = data?.memberRole === "admin" || data?.memberRole === "owner";

  // Handle plan upgrade checkout
  const handleUpgradeConfirm = async () => {
    if (!selectedPlan) return;

    setIsProcessing(true);
    try {
      const res = await createCheckoutSessionFn({
        data: {
          planTier: selectedPlan.id as "pro" | "enterprise",
          billingCycle,
        },
      });

      if (res?.success) {
        toast.success(`Successfully activated ${selectedPlan.name}!`, {
          description: "Your workspace has been upgraded and limits expanded.",
        });

        // Broadcast custom event so AppShell and other components update immediately
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("silex_workspace_updated", {
              detail: { planTier: selectedPlan.id },
            }),
          );
        }

        setUpgradeDialogOpen(false);
        await loadBillingData();
      }
    } catch (err: any) {
      toast.error("Upgrade failed", {
        description: err?.message || "Unable to complete subscription upgrade.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle subscription cancellation
  const handleCancelConfirm = async () => {
    setIsProcessing(true);
    try {
      const res = await cancelSubscriptionFn({ data: {} });
      if (res?.success) {
        toast.success("Subscription cancellation scheduled", {
          description: "You retain access to your plan until the end of the billing period.",
        });
        setCancelDialogOpen(false);
        await loadBillingData();
      }
    } catch (err: any) {
      toast.error("Cancellation failed", {
        description: err?.message || "Could not schedule cancellation.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle subscription resumption
  const handleResumeSubscription = async () => {
    setIsProcessing(true);
    try {
      const res = await resumeSubscriptionFn({ data: {} });
      if (res?.success) {
        toast.success("Subscription resumed successfully", {
          description: "Your plan will renew normally at the end of the current period.",
        });
        await loadBillingData();
      }
    } catch (err: any) {
      toast.error("Resumption failed", {
        description: err?.message || "Could not resume subscription.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading billing and plans…</p>
        </div>
      </div>
    );
  }

  const currentTier = data?.workspace.planTier || "free";
  const sub = data?.subscription;
  const usage = data?.usage;

  // Format renewal date
  const periodEndDate = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Role permission alert banner */}
      {!isAdminOrOwner && (
        <div className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-[13px] text-warning">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>
            <strong>Read-only access:</strong> You are currently viewing billing as a Member. Only
            Workspace Admins and Owners can manage plans or upgrade subscriptions.
          </span>
        </div>
      )}

      {/* 1. Current Plan & Subscription Status Card */}
      <div className="rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl hover-lift">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-violet text-primary-foreground shadow-sm">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {data?.currentPlan.name || "Free Trial"}
                </h2>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                    currentTier === "enterprise"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : currentTier === "pro"
                      ? "bg-violet/20 text-violet border border-violet/30"
                      : "bg-muted text-muted-foreground border border-border",
                  )}
                >
                  {currentTier === "pro" ? "Studio" : currentTier}
                </span>
                {sub?.cancelAtPeriodEnd && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive border border-destructive/30">
                    <Clock className="h-3 w-3" /> Canceling
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {sub?.cancelAtPeriodEnd
                  ? `Access remains active until ${periodEndDate}. Your plan will not renew.`
                  : periodEndDate
                  ? `Your billing cycle renews on ${periodEndDate}.`
                  : "Free starter tier. Upgrade anytime to unlock unlimited projects & AI tools."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sub && sub.cancelAtPeriodEnd ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResumeSubscription}
                disabled={!isAdminOrOwner || isProcessing}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> Resume Subscription
              </Button>
            ) : currentTier !== "free" && sub ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCancelDialogOpen(true)}
                disabled={!isAdminOrOwner || isProcessing}
                className="text-muted-foreground hover:text-destructive"
              >
                Cancel Subscription
              </Button>
            ) : null}

            {currentTier === "free" && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedPlan(data?.plans.find((p) => p.id === "pro") || null);
                  setUpgradeDialogOpen(true);
                }}
                disabled={!isAdminOrOwner}
                className="gap-1.5 shadow-float"
              >
                <Sparkles className="h-4 w-4 text-violet" /> Upgrade to Studio
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Usage & Quotas Meter */}
      <div className="rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Workspace Resource Usage
        </h3>
        <p className="text-[12px] text-muted-foreground">
          Current resource allocation against your active plan limits.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Invoices */}
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <div className="flex items-center justify-between text-muted-foreground text-[12px]">
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" /> Invoices
              </span>
              <span>
                {data?.currentPlan.limits.maxInvoicesPerMonth === null
                  ? "Unlimited"
                  : `Limit: ${data?.currentPlan.limits.maxInvoicesPerMonth}/mo`}
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight">
              {usage?.invoicesCount ?? 0}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width:
                    data?.currentPlan.limits.maxInvoicesPerMonth === null
                      ? "100%"
                      : `${Math.min(
                          100,
                          ((usage?.invoicesCount ?? 0) /
                            data!.currentPlan.limits.maxInvoicesPerMonth) *
                            100,
                        )}%`,
                }}
              />
            </div>
          </div>

          {/* CRM Clients */}
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <div className="flex items-center justify-between text-muted-foreground text-[12px]">
              <span className="flex items-center gap-1.5">
                <Building className="h-4 w-4 text-violet" /> CRM Clients
              </span>
              <span>
                {data?.currentPlan.limits.maxClients === null
                  ? "Unlimited"
                  : `Limit: ${data?.currentPlan.limits.maxClients}`}
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight">
              {usage?.clientsCount ?? 0}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-violet transition-all"
                style={{
                  width:
                    data?.currentPlan.limits.maxClients === null
                      ? "100%"
                      : `${Math.min(
                          100,
                          ((usage?.clientsCount ?? 0) / data!.currentPlan.limits.maxClients) * 100,
                        )}%`,
                }}
              />
            </div>
          </div>

          {/* Active Projects */}
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <div className="flex items-center justify-between text-muted-foreground text-[12px]">
              <span className="flex items-center gap-1.5">
                <FolderKanban className="h-4 w-4 text-emerald-400" /> Projects
              </span>
              <span>
                {data?.currentPlan.limits.maxProjects === null
                  ? "Unlimited"
                  : `Limit: ${data?.currentPlan.limits.maxProjects}`}
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight">
              {usage?.projectsCount ?? 0}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{
                  width:
                    data?.currentPlan.limits.maxProjects === null
                      ? "100%"
                      : `${Math.min(
                          100,
                          ((usage?.projectsCount ?? 0) / data!.currentPlan.limits.maxProjects) * 100,
                        )}%`,
                }}
              />
            </div>
          </div>

          {/* Team Members */}
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <div className="flex items-center justify-between text-muted-foreground text-[12px]">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-amber-400" /> Members
              </span>
              <span>
                {data?.currentPlan.limits.maxMembers === null
                  ? "Unlimited"
                  : `Limit: ${data?.currentPlan.limits.maxMembers}`}
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight">
              {usage?.membersCount ?? 0}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-amber-400 transition-all"
                style={{
                  width:
                    data?.currentPlan.limits.maxMembers === null
                      ? "100%"
                      : `${Math.min(
                          100,
                          ((usage?.membersCount ?? 0) / data!.currentPlan.limits.maxMembers) * 100,
                        )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Available Plans Comparison Grid */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            Available Plans & Upgrades
          </h3>
          <p className="text-[13px] text-muted-foreground">
            Scale your operations seamlessly as your studio grows.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {data?.plans.map((plan) => {
            const isCurrent = currentTier === plan.id;
            const isPro = plan.id === "pro";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-3xl border p-6 transition-all",
                  isPro
                    ? "border-violet/60 bg-card/80 shadow-float ring-1 ring-violet/40"
                    : "border-border/70 bg-card/50",
                )}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-primary to-violet px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                    {plan.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold tracking-tight text-foreground">
                      {plan.name}
                    </h4>
                    {isCurrent && (
                      <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-semibold text-success border border-success/30">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight text-foreground">
                      ${plan.priceMonthly}
                    </span>
                    <span className="text-xs text-muted-foreground">/month</span>
                  </div>

                  <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="mt-5 space-y-2.5 border-t border-border/60 pt-4">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                        <Check className="h-4 w-4 shrink-0 text-violet" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4">
                  {isCurrent ? (
                    <Button variant="outline" size="sm" disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      variant={isPro ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedPlan(plan);
                        setUpgradeDialogOpen(true);
                      }}
                      disabled={!isAdminOrOwner}
                      className={cn("w-full gap-1", isPro && "shadow-float")}
                    >
                      {currentTier === "enterprise" && plan.id === "pro"
                        ? "Switch to Studio"
                        : `Upgrade to ${plan.name}`}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Modal Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet" />
              Upgrade to {selectedPlan?.name}
            </DialogTitle>
            <DialogDescription>
              Confirm plan upgrade for your active workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Billing cycle toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-1 text-center text-xs font-medium">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "rounded-lg py-1.5 transition",
                  billingCycle === "monthly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Monthly (${selectedPlan?.priceMonthly}/mo)
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "rounded-lg py-1.5 transition",
                  billingCycle === "yearly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Yearly (${selectedPlan?.priceYearly}/yr · Save 16%)
              </button>
            </div>

            {/* Plan features summary */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-3 space-y-2 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">Included features:</div>
              {selectedPlan?.features.slice(0, 4).map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-violet shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {/* Student & Dev Sandbox Note */}
            <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Student-Friendly Sandbox:</strong> This installation runs in zero-cost mode.
                Plan upgrades update PostgreSQL state with RFC UUIDv7 keys and Drizzle transactions
                without requiring external credit card charges.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUpgradeDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleUpgradeConfirm} disabled={isProcessing} className="gap-1.5">
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm & Activate Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation Confirmation Alert Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cancel Subscription?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until the end of your billing cycle on{" "}
              <strong>{periodEndDate}</strong>. After this date, your workspace will transition to the
              Free Trial plan and feature limits will apply.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Confirm Cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
