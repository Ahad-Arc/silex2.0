import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getAutomationRunByIdFn,
  type AutomationRunItem,
} from "@/lib/server-functions/automation";

interface ExecutionDetailDrawerProps {
  runId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function ExecutionDetailDrawer({ runId, onOpenChange }: ExecutionDetailDrawerProps) {
  const [run, setRun] = useState<AutomationRunItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      return;
    }

    async function loadRunDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await getAutomationRunByIdFn({ data: { runId: runId! } });
        setRun(res.run);
      } catch (err: any) {
        setError(err.message || "Failed to load execution run details.");
      } finally {
        setLoading(false);
      }
    }

    loadRunDetail();
  }, [runId]);

  function getStatusBadge(status: string) {
    if (status === "completed") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/30 gap-1 text-[11px]">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </Badge>
      );
    }
    if (status === "skipped") {
      return (
        <Badge variant="secondary" className="gap-1 text-[11px]">
          <Clock className="h-3 w-3" /> Skipped
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1 text-[11px]">
        <AlertCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  }

  return (
    <Sheet open={!!runId} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto space-y-5">
        <SheetHeader>
          <SheetTitle className="text-lg font-display">Workflow Run Execution Detail</SheetTitle>
          <SheetDescription className="text-[12.5px]">
            Server-sanitized execution log &amp; condition evaluation diagnostics.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-[12.5px]">Fetching execution run details...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-[12.5px] text-destructive">
            {error}
          </div>
        ) : run ? (
          <div className="space-y-4 text-[12.5px]">
            {/* Metadata Summary */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Execution Status</span>
                {getStatusBadge(run.status)}
              </div>
              <div className="flex items-center justify-between border-t border-border/40 pt-2">
                <span className="text-xs text-muted-foreground">Rule Name</span>
                <span className="font-medium text-foreground">{run.ruleName || "Rule (Deleted)"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/40 pt-2">
                <span className="text-xs text-muted-foreground">Executed At</span>
                <span className="font-mono text-xs">{new Date(run.executedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/40 pt-2">
                <span className="text-xs text-muted-foreground">Run ID</span>
                <span className="font-mono text-[11px] text-muted-foreground">{run.id}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/40 pt-2">
                <span className="text-xs text-muted-foreground">Outbox Event ID</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {run.outboxEventId || "N/A"}
                </span>
              </div>
            </div>

            {/* Sanitized Logs Viewer */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Sanitized Server Execution Logs
              </label>
              <pre className="rounded-xl border border-border/70 bg-background/80 p-3.5 text-[11.5px] font-mono overflow-x-auto text-muted-foreground leading-relaxed max-h-[400px]">
                {JSON.stringify(run.logs, null, 2)}
              </pre>
              <p className="text-[11px] text-muted-foreground">
                Sensitive keys (secrets, tokens, passwords) are automatically redacted by server function sanitizers.
              </p>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
