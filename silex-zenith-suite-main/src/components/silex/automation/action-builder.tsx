import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getWebhooksFn, type WebhookItem } from "@/lib/server-functions/automation";

export interface ActionItem {
  type: "create_notification" | "create_audit_log" | "update_task_status" | "dispatch_webhook";
  recipientUserId?: string;
  title?: string;
  body?: string;
  actionUrl?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  taskId?: string;
  status?: string;
  webhookId?: string;
  payload?: Record<string, unknown>;
}

interface ActionBuilderProps {
  actions: ActionItem[];
  onChange: (actions: ActionItem[]) => void;
}

const ACTION_TYPES = [
  { value: "create_notification", label: "Create Notification (create_notification)" },
  { value: "create_audit_log", label: "Create Audit Log (create_audit_log)" },
  { value: "update_task_status", label: "Update Task Status (update_task_status)" },
  { value: "dispatch_webhook", label: "Dispatch Webhook (dispatch_webhook)" },
];

const TASK_STATUSES = [
  { value: "todo", label: "To Do (todo)" },
  { value: "in_progress", label: "In Progress (in_progress)" },
  { value: "review", label: "In Review (review)" },
  { value: "completed", label: "Completed (completed)" },
];

export function ActionBuilder({ actions, onChange }: ActionBuilderProps) {
  const [webhooksList, setWebhooksList] = useState<WebhookItem[]>([]);

  useEffect(() => {
    async function loadWebhooks() {
      try {
        const res = await getWebhooksFn({ data: {} });
        setWebhooksList(res.webhooks.filter((w) => w.isActive));
      } catch {
        // Fallback for unauthorized/unloaded states
      }
    }
    loadWebhooks();
  }, []);

  function addAction() {
    onChange([
      ...actions,
      {
        type: "create_notification",
        recipientUserId: "event.actorId",
        title: "Automated Alert",
        body: "Workflow rule triggered automatically.",
      },
    ]);
  }

  function removeAction(index: number) {
    onChange(actions.filter((_, i) => i !== index));
  }

  function updateActionType(index: number, newType: ActionItem["type"]) {
    const updated = [...actions];
    if (newType === "create_notification") {
      updated[index] = {
        type: "create_notification",
        recipientUserId: "event.actorId",
        title: "Automated Alert",
        body: "Workflow rule triggered automatically.",
      };
    } else if (newType === "create_audit_log") {
      updated[index] = {
        type: "create_audit_log",
        action: "automation.rule_executed",
        entityType: "automation_rule",
        entityId: "event.aggregateId",
      };
    } else if (newType === "update_task_status") {
      updated[index] = {
        type: "update_task_status",
        taskId: "event.payload.taskId",
        status: "completed",
      };
    } else if (newType === "dispatch_webhook") {
      updated[index] = {
        type: "dispatch_webhook",
        webhookId: webhooksList[0]?.id || "",
        payload: {},
      };
    }
    onChange(updated);
  }

  function updateActionField(index: number, field: string, value: any) {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-[13px] font-medium text-foreground">Workflow Actions</label>
          <p className="text-[11.5px] text-muted-foreground">
            Allowlisted backend side-effects executed when conditions pass. At least 1 action required.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addAction}
          className="h-7 text-[11.5px] gap-1"
        >
          <Plus className="h-3 w-3" /> Add Action
        </Button>
      </div>

      {actions.length === 0 ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3.5 text-center text-[12px] text-destructive">
          At least one allowlisted action is required to save an automation rule.
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((act, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-border/70 bg-background/60 p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <Select
                    value={act.type}
                    onValueChange={(val) => updateActionType(idx, val as ActionItem["type"])}
                  >
                    <SelectTrigger className="h-7 text-[12px] w-[260px]">
                      <SelectValue placeholder="Select Action Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((a) => (
                        <SelectItem key={a.value} value={a.value} className="text-[12px]">
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAction(idx)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Action specific form fields */}
              {act.type === "create_notification" && (
                <div className="space-y-2 pt-1 text-[12px]">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Recipient User ID / Path
                      </label>
                      <Input
                        value={act.recipientUserId || ""}
                        onChange={(e) => updateActionField(idx, "recipientUserId", e.target.value)}
                        placeholder="event.actorId or User UUID"
                        className="h-8 text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Action URL (Optional)</label>
                      <Input
                        value={act.actionUrl || ""}
                        onChange={(e) => updateActionField(idx, "actionUrl", e.target.value)}
                        placeholder="/app/invoices/INV-1001"
                        className="h-8 text-[12px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Notification Title</label>
                    <Input
                      value={act.title || ""}
                      onChange={(e) => updateActionField(idx, "title", e.target.value)}
                      placeholder="Invoice Payment Received"
                      className="h-8 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Notification Body</label>
                    <Textarea
                      value={act.body || ""}
                      onChange={(e) => updateActionField(idx, "body", e.target.value)}
                      placeholder="Invoice total was paid successfully."
                      className="h-16 text-[12px] resize-none"
                    />
                  </div>
                </div>
              )}

              {act.type === "create_audit_log" && (
                <div className="grid gap-2 sm:grid-cols-3 pt-1 text-[12px]">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Action Name</label>
                    <Input
                      value={act.action || ""}
                      onChange={(e) => updateActionField(idx, "action", e.target.value)}
                      placeholder="invoice.paid_auto"
                      className="h-8 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Entity Type</label>
                    <Input
                      value={act.entityType || ""}
                      onChange={(e) => updateActionField(idx, "entityType", e.target.value)}
                      placeholder="invoice"
                      className="h-8 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Entity ID / Path</label>
                    <Input
                      value={act.entityId || ""}
                      onChange={(e) => updateActionField(idx, "entityId", e.target.value)}
                      placeholder="event.aggregateId"
                      className="h-8 text-[12px]"
                    />
                  </div>
                </div>
              )}

              {act.type === "update_task_status" && (
                <div className="grid gap-2 sm:grid-cols-2 pt-1 text-[12px]">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Task ID / Path</label>
                    <Input
                      value={act.taskId || ""}
                      onChange={(e) => updateActionField(idx, "taskId", e.target.value)}
                      placeholder="event.aggregateId or Task UUID"
                      className="h-8 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Target Task Status</label>
                    <Select
                      value={act.status || "completed"}
                      onValueChange={(val) => updateActionField(idx, "status", val)}
                    >
                      <SelectTrigger className="h-8 text-[12px]">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value} className="text-[12px]">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {act.type === "dispatch_webhook" && (
                <div className="pt-1 text-[12px] space-y-2">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Active Workspace Webhook Target
                    </label>
                    {webhooksList.length === 0 ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11.5px] text-amber-500">
                        No active webhook endpoints registered. Please register a webhook in the &quot;Webhooks&quot; tab first.
                      </div>
                    ) : (
                      <Select
                        value={act.webhookId || ""}
                        onValueChange={(val) => updateActionField(idx, "webhookId", val)}
                      >
                        <SelectTrigger className="h-8 text-[12px]">
                          <SelectValue placeholder="Select Webhook Endpoint" />
                        </SelectTrigger>
                        <SelectContent>
                          {webhooksList.map((wh) => (
                            <SelectItem key={wh.id} value={wh.id} className="text-[12px]">
                              {wh.targetUrl}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
