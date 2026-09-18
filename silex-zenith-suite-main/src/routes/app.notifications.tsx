import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Check, DollarSign, Users, FileText, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/supabase";
import {
  getNotificationsFn,
  markNotificationReadFn,
  markAllNotificationsReadFn,
  type NotificationItem,
} from "@/lib/server-functions/notifications";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — SILEX" },
      { name: "description", content: "Everything that changed." },
    ],
  }),
  component: Notifications,
});

const toneRing: Record<string, string> = {
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
  violet: "bg-violet/10 text-violet",
};

const getIconForType = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes("payment") || t.includes("invoice paid") || t.includes("revenue")) return DollarSign;
  if (t.includes("ai") || t.includes("drafted") || t.includes("zenith")) return Sparkles;
  if (t.includes("client") || t.includes("user")) return Users;
  if (t.includes("overdue") || t.includes("alert")) return AlertTriangle;
  if (t.includes("completed") || t.includes("signed")) return Check;
  return FileText;
};

const getToneForType = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes("payment") || t.includes("signed") || t.includes("paid")) return "success";
  if (t.includes("overdue") || t.includes("alert") || t.includes("error")) return "destructive";
  if (t.includes("ai") || t.includes("zenith") || t.includes("client")) return "violet";
  return undefined;
};

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await getNotificationsFn({
        data: {
          unreadOnly: activeTab === "Unread",
          limit: 50,
        },
      });
      setItems(res.notifications || []);
    } catch {
      // Safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [activeTab]);

  useRealtimeNotifications({
    recipientUserId: user?.id,
    onNotification: () => {
      loadNotifications();
    },
  });

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationReadFn({ data: { notificationId: id } });
      setItems((list) =>
        list.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n))
      );
    } catch {
      // Safe fallback
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadFn();
      setItems((list) => list.map((n) => ({ ...n, isRead: true, readAt: new Date() })));
    } catch {
      // Safe fallback
    }
  };

  const filteredItems = items.filter((n) => {
    if (activeTab === "Unread") return !n.isRead;
    if (activeTab === "Payments") return n.title.toLowerCase().includes("payment") || n.title.toLowerCase().includes("invoice");
    if (activeTab === "Clients") return n.title.toLowerCase().includes("client");
    if (activeTab === "AI") return n.title.toLowerCase().includes("ai") || n.title.toLowerCase().includes("zenith");
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Notifications</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Everything that matters, nothing that doesn't.
          </p>
        </div>
        <button onClick={handleMarkAllRead} className="text-[12px] text-primary hover:underline">
          Mark all read
        </button>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-0.5 text-[12px] w-fit">
        {["All", "Unread", "Payments", "Clients", "AI"].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-3xl border border-border/70 bg-card/70 p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-violet" />
          <span className="text-xs">Loading notifications...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-border/70 bg-card/70 p-12 text-center text-muted-foreground space-y-2">
          <Bell className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <div className="text-sm font-medium">No notifications</div>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            You're all caught up! New workspace events will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="space-y-8 stagger">
          <section>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">
              Recent Activity
            </div>
            <div className="rounded-3xl border border-border/70 bg-card/70 divide-y divide-border/60 overflow-hidden">
              {filteredItems.map((n) => {
                const IconComponent = getIconForType(n.title);
                const tone = getToneForType(n.title);
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.isRead && handleMarkRead(n.id)}
                    className={`flex items-start gap-3 px-5 py-4 hover:bg-muted/40 transition cursor-pointer ${
                      !n.isRead ? "bg-violet/5" : ""
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        tone ? toneRing[tone] : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-medium">{n.title}</span>
                        {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-violet" />}
                      </div>
                      <div className="text-[12.5px] text-muted-foreground truncate">{n.body}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0">
                      {formatTimeAgo(n.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
