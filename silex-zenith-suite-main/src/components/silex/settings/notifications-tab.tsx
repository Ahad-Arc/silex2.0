import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Bell,
  Mail,
  MessageSquare,
  Sparkles,
  Check,
  Loader2,
  DollarSign,
  CheckSquare,
  MessageCircle,
  UserCheck,
  Receipt,
  Info,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  getNotificationPreferencesFn,
  updateNotificationPreferencesFn,
  DEFAULT_NOTIFICATION_EVENT_TYPES,
} from "@/lib/server-functions/notifications";

export function NotificationsTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Delivery channels state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [slackNotifications, setSlackNotifications] = useState(false);

  // Event types state
  const [eventTypes, setEventTypes] = useState<Record<string, boolean>>({
    ...DEFAULT_NOTIFICATION_EVENT_TYPES,
  });

  const loadPreferences = async () => {
    setIsLoading(true);
    try {
      const res = await getNotificationPreferencesFn({});
      if (res?.preferences) {
        setEmailNotifications(res.preferences.emailNotifications);
        setPushNotifications(res.preferences.pushNotifications);
        setSlackNotifications(res.preferences.slackNotifications);
        setEventTypes({
          ...DEFAULT_NOTIFICATION_EVENT_TYPES,
          ...(res.preferences.eventTypes || {}),
        });
      }
    } catch (err: any) {
      toast.error("Failed to load notification preferences", {
        description: err?.message || "Please refresh and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const handleToggleEvent = (key: string, value: boolean) => {
    setEventTypes((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateNotificationPreferencesFn({
        data: {
          emailNotifications,
          pushNotifications,
          slackNotifications,
          eventTypes,
        },
      });

      toast.success("Preferences updated", {
        description: "Your notification and delivery settings have been saved.",
      });
    } catch (err: any) {
      toast.error("Failed to update preferences", {
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
        <p className="text-[13px] text-muted-foreground">Loading notification settings…</p>
      </div>
    );
  }

  const EVENT_CONFIGS = [
    {
      id: "task_assigned",
      label: "Task Assignments & Status",
      desc: "When a task is assigned to you or updated in your active projects.",
      icon: CheckSquare,
    },
    {
      id: "invoice_paid",
      label: "Invoice Paid & Revenue",
      desc: "Instant notifications when a client settles an invoice.",
      icon: DollarSign,
    },
    {
      id: "comment_added",
      label: "Comments & Mentions",
      desc: "When a team member comments on a task or document you follow.",
      icon: MessageCircle,
    },
    {
      id: "client_created",
      label: "New CRM Clients",
      desc: "When a new client or organization is added to the workspace.",
      icon: UserCheck,
    },
    {
      id: "expense_recorded",
      label: "Expenses Logged",
      desc: "When a new operating or project expense is recorded.",
      icon: Receipt,
    },
    {
      id: "ai_insight",
      label: "Zenith AI Proactive Insights",
      desc: "When Zenith AI detects revenue anomalies or surfaces project recommendations.",
      icon: Sparkles,
    },
  ];

  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-6 space-y-6">
      <div className="border-b border-border/60 pb-4">
        <h2 className="text-lg font-display">Notification Preferences</h2>
        <p className="text-[12.5px] text-muted-foreground">
          Choose where and when SILEX notifies you about workspace activity.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Delivery Channels Section */}
        <div className="space-y-3">
          <div className="text-[13px] font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-4 w-4 text-violet" /> Delivery Channels
          </div>
          <p className="text-[12px] text-muted-foreground">
            Configure which destinations SILEX should use to deliver alerts.
          </p>

          <div className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-background/50 overflow-hidden">
            {/* Push / In-App */}
            <div className="flex items-center justify-between gap-4 p-4 hover:bg-muted/20 transition">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet/10 text-violet">
                  <Bell className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[13px] font-medium">In-App & Realtime Push</div>
                  <div className="text-[12px] text-muted-foreground">
                    Show real-time badge counters and alert feeds in the top navigation bar.
                  </div>
                </div>
              </div>
              <Switch
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
                disabled={isSaving}
              />
            </div>

            {/* Email */}
            <div className="flex items-center justify-between gap-4 p-4 hover:bg-muted/20 transition">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[13px] font-medium">Email Notifications</div>
                  <div className="text-[12px] text-muted-foreground">
                    Send email notifications for critical workspace updates and payment receipts.
                  </div>
                </div>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
                disabled={isSaving}
              />
            </div>

            {/* Slack */}
            <div className="flex items-center justify-between gap-4 p-4 hover:bg-muted/20 transition">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[13px] font-medium">Slack Integration</div>
                  <div className="text-[12px] text-muted-foreground">
                    Deliver events to connected workspace Slack channels via webhooks.
                  </div>
                </div>
              </div>
              <Switch
                checked={slackNotifications}
                onCheckedChange={setSlackNotifications}
                disabled={isSaving}
              />
            </div>
          </div>

          {slackNotifications && (
            <div className="flex items-start gap-2.5 rounded-xl border border-violet/20 bg-violet/5 p-3 text-[12px] text-violet-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-violet" />
              <span>
                Slack channel routing can be managed via outbound webhooks in{" "}
                <span className="font-medium text-foreground">Automation & webhooks</span>.
              </span>
            </div>
          )}
        </div>

        {/* Workspace Event Subscriptions Section */}
        <div className="space-y-3 pt-2">
          <div className="text-[13px] font-semibold tracking-tight text-foreground flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-violet" /> Event Subscriptions
          </div>
          <p className="text-[12px] text-muted-foreground">
            Select the specific workspace events you wish to receive notifications for.
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {EVENT_CONFIGS.map((evt) => {
              const Icon = evt.icon;
              const isChecked = eventTypes[evt.id] ?? true;
              return (
                <div
                  key={evt.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/50 p-4 hover:bg-muted/20 transition"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{evt.label}</div>
                      <div className="text-[11.5px] text-muted-foreground line-clamp-2">
                        {evt.desc}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={isChecked}
                    onCheckedChange={(val) => handleToggleEvent(evt.id, val)}
                    disabled={isSaving}
                    className="shrink-0 mt-1"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
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
      </form>
    </div>
  );
}
