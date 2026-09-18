import { useEffect, useState } from "react";
import { Send, CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
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
  getWebhookDeliveriesFn,
  getWebhooksFn,
  type WebhookDeliveryItem,
  type WebhookItem,
} from "@/lib/server-functions/automation";

export function WebhookDeliveriesTab() {
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [availableWebhooks, setAvailableWebhooks] = useState<WebhookItem[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [page, setPage] = useState(1);
  const limit = 15;

  useEffect(() => {
    async function loadWebhooks() {
      try {
        const res = await getWebhooksFn({ data: {} });
        setAvailableWebhooks(res.webhooks);
      } catch {
        // Fallback
      }
    }
    loadWebhooks();
  }, []);

  async function loadDeliveries() {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * limit;
      const res = await getWebhookDeliveriesFn({
        data: {
          webhookId: selectedWebhookId === "all" ? undefined : selectedWebhookId,
          status:
            selectedStatus === "all"
              ? undefined
              : (selectedStatus as "pending" | "processing" | "delivered" | "failed"),
          limit,
          offset,
        },
      });
      setDeliveries(res.deliveries);
      setTotalCount(res.totalCount);
    } catch (err: any) {
      setError(err.message || "Failed to load webhook delivery history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeliveries();
  }, [selectedWebhookId, selectedStatus, page]);

  function getStatusBadge(status: string, code: number | null) {
    if (status === "delivered" || (code && code >= 200 && code < 300)) {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1 text-[11px]">
          <CheckCircle2 className="h-3 w-3" /> {code ? `${code} Delivered` : "Delivered"}
        </Badge>
      );
    }
    if (status === "pending" || status === "processing") {
      return (
        <Badge variant="secondary" className="gap-1 text-[11px]">
          <Clock className="h-3 w-3" /> {status}
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1 text-[11px]">
        <AlertCircle className="h-3 w-3" /> {code ? `${code} Failed` : "Failed"}
      </Badge>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="space-y-4">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Webhook Deliveries</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Outbound HTTP delivery attempt logs, status codes, and response body snippets.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Webhook Endpoint Filter */}
          <Select
            value={selectedWebhookId}
            onValueChange={(val) => {
              setSelectedWebhookId(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-[12px] w-[200px]">
              <SelectValue placeholder="All Webhooks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[12px]">
                All Webhook Endpoints
              </SelectItem>
              {availableWebhooks.map((w) => (
                <SelectItem key={w.id} value={w.id} className="text-[12px] font-mono">
                  {w.targetUrl}
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
              <SelectItem value="delivered" className="text-[12px]">
                Delivered
              </SelectItem>
              <SelectItem value="pending" className="text-[12px]">
                Pending
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
          <AlertTitle>Error Loading Webhook Deliveries</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={loadDeliveries}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : deliveries.length === 0 ? (
        <Card className="p-8 border-border/70 bg-card/60 backdrop-blur-xl text-center space-y-2">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Send className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No Webhook Delivery Attempt Logs</h3>
          <p className="text-[12.5px] text-muted-foreground">
            No outbound HTTP deliveries match the selected endpoint or status filters.
          </p>
        </Card>
      ) : (
        <Card className="border-border/70 bg-card/70 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] text-left">
              <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Attempted At</th>
                  <th className="px-4 py-3">Target Endpoint</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Retries</th>
                  <th className="px-4 py-3">Response Snippet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 font-mono text-muted-foreground text-[11.5px]">
                      {new Date(del.attemptedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-foreground max-w-[220px] truncate">
                      {del.targetUrl || "Endpoint Deleted"}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(del.status, del.responseStatusCode)}</td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-muted-foreground">
                      {del.executionDurationMs !== null ? `${del.executionDurationMs} ms` : "N/A"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-muted-foreground">
                      Attempt {del.retryCount + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground max-w-[240px] truncate">
                      {del.errorMessage
                        ? `Error: ${del.errorMessage}`
                        : del.responseBody || "No response body"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-[12px] text-muted-foreground">
              <span>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)} of {totalCount} deliveries
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
    </div>
  );
}
