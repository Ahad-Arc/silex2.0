import { useState } from "react";
import { Cpu, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  triggerAutomationOutboxWorkerFn,
  triggerWebhookDeliveryWorkerFn,
} from "@/lib/server-functions/automation";

export function WorkerHealthCard() {
  const [outboxLoading, setOutboxLoading] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);

  const [outboxMetrics, setOutboxMetrics] = useState<{
    claimedCount: number;
    processedCount: number;
    failedCount: number;
    recoveredStaleCount: number;
  } | null>(null);

  const [webhookMetrics, setWebhookMetrics] = useState<{
    claimedCount: number;
    deliveredCount: number;
    failedCount: number;
    retriedCount: number;
    recoveredStaleCount: number;
  } | null>(null);

  async function handleTriggerOutboxWorker() {
    if (outboxLoading) return;
    setOutboxLoading(true);
    try {
      const res = await triggerAutomationOutboxWorkerFn({ data: { batchSize: 10 } });
      setOutboxMetrics(res);
      toast.success(
        `Outbox worker completed: ${res.processedCount} processed, ${res.failedCount} failed, ${res.recoveredStaleCount} recovered.`
      );
    } catch (err: any) {
      toast.error(`Outbox worker trigger failed: ${err.message || "Unauthorized or execution error"}`);
    } finally {
      setOutboxLoading(false);
    }
  }

  async function handleTriggerWebhookWorker() {
    if (webhookLoading) return;
    setWebhookLoading(true);
    try {
      const res = await triggerWebhookDeliveryWorkerFn({ data: { batchSize: 10 } });
      setWebhookMetrics(res);
      toast.success(
        `Webhook worker completed: ${res.deliveredCount} delivered, ${res.failedCount} failed, ${res.retriedCount} retried.`
      );
    } catch (err: any) {
      toast.error(`Webhook worker trigger failed: ${err.message || "Unauthorized or execution error"}`);
    } finally {
      setWebhookLoading(false);
    }
  }

  return (
    <Card className="p-5 border-border/70 bg-card/70 backdrop-blur-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Worker Execution Diagnostics
            </h3>
            <p className="text-[12px] text-muted-foreground">
              Manual batch processing triggers &amp; last batch processing metrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTriggerOutboxWorker}
            disabled={outboxLoading}
            className="text-[12px] h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${outboxLoading ? "animate-spin" : ""}`} />
            Process Outbox Batch
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleTriggerWebhookWorker}
            disabled={webhookLoading}
            className="text-[12px] h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${webhookLoading ? "animate-spin" : ""}`} />
            Process Webhooks Batch
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Outbox Metrics Panel */}
        <div className="rounded-xl border border-border/60 bg-background/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-foreground">Outbox Worker</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              Batch size: 10
            </Badge>
          </div>
          {outboxMetrics ? (
            <div className="grid grid-cols-4 gap-2 pt-1 text-center">
              <div className="rounded-lg bg-card/60 p-2">
                <div className="text-[10px] text-muted-foreground uppercase">Claimed</div>
                <div className="text-sm font-semibold font-mono text-foreground">{outboxMetrics.claimedCount}</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <div className="text-[10px] text-emerald-500 uppercase">Processed</div>
                <div className="text-sm font-semibold font-mono text-emerald-500">{outboxMetrics.processedCount}</div>
              </div>
              <div className="rounded-lg bg-destructive/10 p-2">
                <div className="text-[10px] text-destructive uppercase">Failed</div>
                <div className="text-sm font-semibold font-mono text-destructive">{outboxMetrics.failedCount}</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-2">
                <div className="text-[10px] text-amber-500 uppercase">Recovered</div>
                <div className="text-sm font-semibold font-mono text-amber-500">{outboxMetrics.recoveredStaleCount}</div>
              </div>
            </div>
          ) : (
            <p className="text-[11.5px] text-muted-foreground py-1">
              No manual outbox batch executed yet in this session. Click &quot;Process Outbox Batch&quot; to run.
            </p>
          )}
        </div>

        {/* Webhook Metrics Panel */}
        <div className="rounded-xl border border-border/60 bg-background/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-foreground">Webhook Worker</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              Batch size: 10
            </Badge>
          </div>
          {webhookMetrics ? (
            <div className="grid grid-cols-5 gap-1.5 pt-1 text-center">
              <div className="rounded-lg bg-card/60 p-1.5">
                <div className="text-[9px] text-muted-foreground uppercase">Claimed</div>
                <div className="text-sm font-semibold font-mono text-foreground">{webhookMetrics.claimedCount}</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-1.5">
                <div className="text-[9px] text-emerald-500 uppercase">Delivered</div>
                <div className="text-sm font-semibold font-mono text-emerald-500">{webhookMetrics.deliveredCount}</div>
              </div>
              <div className="rounded-lg bg-destructive/10 p-1.5">
                <div className="text-[9px] text-destructive uppercase">Failed</div>
                <div className="text-sm font-semibold font-mono text-destructive">{webhookMetrics.failedCount}</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-1.5">
                <div className="text-[9px] text-amber-500 uppercase">Retried</div>
                <div className="text-sm font-semibold font-mono text-amber-500">{webhookMetrics.retriedCount}</div>
              </div>
              <div className="rounded-lg bg-purple-500/10 p-1.5">
                <div className="text-[9px] text-purple-500 uppercase">Recovered</div>
                <div className="text-sm font-semibold font-mono text-purple-500">{webhookMetrics.recoveredStaleCount}</div>
              </div>
            </div>
          ) : (
            <p className="text-[11.5px] text-muted-foreground py-1">
              No manual webhook batch executed yet in this session. Click &quot;Process Webhooks Batch&quot; to run.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
