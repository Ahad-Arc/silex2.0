import { useEffect, useState } from "react";
import { History, Eye, CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAutomationRunsFn,
  getAutomationRulesFn,
  type AutomationRunItem,
  type AutomationRuleItem,
} from "@/lib/server-functions/automation";
import { ExecutionDetailDrawer } from "./execution-detail-drawer";

interface AutomationHistoryTabProps {
  initialRuleId?: string | null;
}

export function AutomationHistoryTab({ initialRuleId }: AutomationHistoryTabProps) {
  const [runs, setRuns] = useState<AutomationRunItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [availableRules, setAvailableRules] = useState<AutomationRuleItem[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>(initialRuleId || "all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [page, setPage] = useState(1);
  const limit = 15;

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Load available rules for filter dropdown
  useEffect(() => {
    async function loadRules() {
      try {
        const res = await getAutomationRulesFn({ data: {} });
        setAvailableRules(res.rules);
      } catch {
        // Fallback for unauthorized/unloaded states
      }
    }
    loadRules();
  }, []);

  useEffect(() => {
    if (initialRuleId) {
      setSelectedRuleId(initialRuleId);
    }
  }, [initialRuleId]);

  async function loadRuns() {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * limit;
      const res = await getAutomationRunsFn({
        data: {
          ruleId: selectedRuleId === "all" ? undefined : selectedRuleId,
          status:
            selectedStatus === "all"
              ? undefined
              : (selectedStatus as "completed" | "skipped" | "failed"),
          limit,
          offset,
        },
      });
      setRuns(res.runs);
      setTotalCount(res.totalCount);
    } catch (err: any) {
      setError(err.message || "Failed to load workflow execution history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRuns();
  }, [selectedRuleId, selectedStatus, page]);

  function getStatusBadge(status: string) {
    if (status === "completed") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1 text-[11px]">
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

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="space-y-4">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Workflow History</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Server execution logs for outbox event rule evaluations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Rule Filter */}
          <Select
            value={selectedRuleId}
            onValueChange={(val) => {
              setSelectedRuleId(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-[12px] w-[180px]">
              <SelectValue placeholder="All Rules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[12px]">
                All Rules
              </SelectItem>
              {availableRules.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-[12px]">
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={selectedStatus}
            onValueChange={(val) => {
              setSelectedStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-[12px] w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[12px]">
                All Statuses
              </SelectItem>
              <SelectItem value="completed" className="text-[12px]">
                Completed
              </SelectItem>
              <SelectItem value="skipped" className="text-[12px]">
                Skipped
              </SelectItem>
              <SelectItem value="failed" className="text-[12px]">
                Failed
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Workflow History</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={loadRuns}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : runs.length === 0 ? (
        <Card className="p-8 border-border/70 bg-card/60 backdrop-blur-xl text-center space-y-2">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No Workflow Execution Logs Found</h3>
          <p className="text-[12.5px] text-muted-foreground">
            No rule evaluation runs match the selected filters.
          </p>
        </Card>
      ) : (
        <Card className="border-border/70 bg-card/70 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] text-left">
              <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Executed At</th>
                  <th className="px-4 py-3">Rule Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Outbox Event ID</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 font-mono text-muted-foreground text-[11.5px]">
                      {new Date(run.executedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {run.ruleName || <span className="text-muted-foreground italic">Rule Deleted</span>}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(run.status)}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {run.outboxEventId || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedRunId(run.id)}
                        className="h-7 text-[11.5px] gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" /> Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Server-Side Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-[12px] text-muted-foreground">
              <span>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)} of {totalCount} runs
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 w-7"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 font-mono">
                  {page} / {totalPages}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 w-7"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Execution Detail Drawer */}
      <ExecutionDetailDrawer
        runId={selectedRunId}
        onOpenChange={(open) => !open && setSelectedRunId(null)}
      />
    </div>
  );
}
