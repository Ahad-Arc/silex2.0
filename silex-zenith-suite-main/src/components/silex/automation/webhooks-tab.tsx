import { useEffect, useState } from "react";
import { Plus, Webhook, Trash2, Edit2, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { DOMAIN_EVENT_TYPES, type DomainEventType } from "@/lib/events/types";
import {
  getWebhooksFn,
  createWebhookFn,
  updateWebhookFn,
  deleteWebhookFn,
  type WebhookItem,
} from "@/lib/server-functions/automation";
import { WebhookSecretModal } from "./webhook-secret-modal";

export function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // One-time secret display state
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);

  const [targetUrl, setTargetUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<DomainEventType[]>([
    "invoice.paid",
    "payment.created",
  ]);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog state
  const [webhookToDelete, setWebhookToDelete] = useState<WebhookItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadWebhooks() {
    setLoading(true);
    setError(null);
    try {
      const res = await getWebhooksFn({ data: {} });
      setWebhooks(res.webhooks);
    } catch (err: any) {
      setError(err.message || "Failed to load webhooks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWebhooks();
  }, []);

  function handleOpenCreate() {
    setEditingWebhook(null);
    setTargetUrl("https://example.com/api/webhooks");
    setSelectedEvents(["invoice.paid", "payment.created"]);
    setIsActive(true);
    setModalOpen(true);
  }

  function handleOpenEdit(wh: WebhookItem) {
    setEditingWebhook(wh);
    setTargetUrl(wh.targetUrl);
    setSelectedEvents(wh.subscribedEvents as DomainEventType[]);
    setIsActive(wh.isActive);
    setModalOpen(true);
  }

  function toggleEventSubscription(evt: DomainEventType) {
    if (selectedEvents.includes(evt)) {
      setSelectedEvents(selectedEvents.filter((e) => e !== evt));
    } else {
      setSelectedEvents([...selectedEvents, evt]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUrl.trim()) {
      toast.error("Target URL is required.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingWebhook) {
        await updateWebhookFn({
          data: {
            webhookId: editingWebhook.id,
            targetUrl: targetUrl.trim(),
            subscribedEvents: selectedEvents,
            isActive,
          },
        });
        toast.success("Webhook endpoint updated.");
      } else {
        const res = await createWebhookFn({
          data: {
            targetUrl: targetUrl.trim(),
            subscribedEvents: selectedEvents,
          },
        });
        toast.success("Webhook endpoint created successfully.");
        if (res.secret) {
          setCreatedSecret(res.secret);
        }
      }
      setModalOpen(false);
      await loadWebhooks();
    } catch (err: any) {
      toast.error(`Webhook operation failed: ${err.message || "SSRF pre-flight failure or unauthorized"}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(wh: WebhookItem, nextState: boolean) {
    setWebhooks((prev) =>
      prev.map((w) => (w.id === wh.id ? { ...w, isActive: nextState } : w))
    );

    try {
      await updateWebhookFn({
        data: { webhookId: wh.id, isActive: nextState },
      });
      toast.success(
        `Webhook "${wh.targetUrl}" ${nextState ? "activated" : "deactivated"}.`
      );
    } catch (err: any) {
      setWebhooks((prev) =>
        prev.map((w) => (w.id === wh.id ? { ...w, isActive: !nextState } : w))
      );
      toast.error(`Failed to update webhook state: ${err.message || "Unauthorized"}`);
    }
  }

  async function handleDeleteWebhook() {
    if (!webhookToDelete) return;
    setDeleting(true);
    try {
      await deleteWebhookFn({ data: { webhookId: webhookToDelete.id } });
      toast.success("Webhook endpoint deleted.");
      setWebhookToDelete(null);
      await loadWebhooks();
    } catch (err: any) {
      toast.error(`Failed to delete webhook: ${err.message || "Unauthorized"}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Webhook Endpoints</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Register outbound HTTPS endpoints for HMAC-SHA256 signed event pushes.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-float text-[13px] h-9 gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" /> Register Webhook
        </Button>
      </div>

      {/* Content states */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Webhooks</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={loadWebhooks}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : webhooks.length === 0 ? (
        <Card className="p-8 border-border/70 bg-card/60 backdrop-blur-xl text-center space-y-3">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Webhook className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">No Webhook Endpoints Registered</h3>
            <p className="text-[12.5px] text-muted-foreground max-w-md mx-auto">
              Receive real-time HTTPS notifications when domain events occur. All payloads are signed with HMAC-SHA256.
            </p>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-float text-[12.5px] h-8 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Register Your First Webhook
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <Card
              key={wh.id}
              className="p-4 border-border/70 bg-card/70 backdrop-blur-xl hover:border-violet/40 transition space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold font-mono text-foreground truncate">
                      {wh.targetUrl}
                    </span>
                    <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                      <ShieldCheck className="h-3 w-3" /> HTTPS Verified
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11.5px] text-muted-foreground mr-1">Events:</span>
                    {wh.subscribedEvents.map((evt: string) => (
                      <Badge key={evt} variant="secondary" className="font-mono text-[10.5px]">
                        {evt}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Switch
                    checked={wh.isActive}
                    onCheckedChange={(next) => handleToggleActive(wh, next)}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleOpenEdit(wh)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setWebhookToDelete(wh)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Webhook Create/Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-display">
                {editingWebhook ? "Edit Webhook Endpoint" : "Register Webhook Endpoint"}
              </DialogTitle>
              <DialogDescription className="text-[12.5px]">
                Must use HTTPS. SSRF pre-flight validation will reject plain HTTP, localhost, and internal IPs.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-[12.5px]">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Target HTTPS URL</label>
                <Input
                  type="url"
                  placeholder="https://your-api.com/webhooks/silex"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  required
                  className="font-mono text-[12.5px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Subscribed Domain Events</label>
                <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto border border-border/70 rounded-xl p-2.5 bg-background/60">
                  {DOMAIN_EVENT_TYPES.map((evt) => (
                    <div key={evt} className="flex items-center gap-2 text-[11.5px]">
                      <Checkbox
                        id={`evt-${evt}`}
                        checked={selectedEvents.includes(evt)}
                        onCheckedChange={() => toggleEventSubscription(evt)}
                      />
                      <label htmlFor={`evt-${evt}`} className="font-mono truncate cursor-pointer">
                        {evt}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {editingWebhook && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-medium text-foreground">Endpoint Active Status</span>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-float"
              >
                {submitting
                  ? "Validating..."
                  : editingWebhook
                  ? "Save Changes"
                  : "Register & Generate Secret"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* One-Time Signing Secret Modal */}
      <WebhookSecretModal secret={createdSecret} onClose={() => setCreatedSecret(null)} />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!webhookToDelete} onOpenChange={(o) => !o && setWebhookToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook Endpoint?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px]">
              Are you sure you want to delete the endpoint &quot;{webhookToDelete?.targetUrl}&quot;? Existing delivery history will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWebhook}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Endpoint"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
