import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface RealtimeNotificationOptions {
  workspaceId?: string;
  recipientUserId?: string;
  onNotification?: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void;
}

/**
 * Custom React Hook: useRealtimeNotifications
 * Manages Supabase Realtime WebSocket subscriptions for notification changes.
 * Scoped to authorized workspace and recipient user ID with automatic channel cleanup on unmount.
 */
export function useRealtimeNotifications({
  workspaceId,
  recipientUserId,
  onNotification,
}: RealtimeNotificationOptions) {
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  useEffect(() => {
    if (!workspaceId || !recipientUserId || typeof window === "undefined") {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channelName = `notifs:${workspaceId}:${recipientUserId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          // Verify recipient_user_id matches target recipient
          const newRecord = (payload.new || {}) as Record<string, unknown>;
          if (newRecord.recipient_user_id && newRecord.recipient_user_id !== recipientUserId) {
            return;
          }

          if (callbackRef.current) {
            callbackRef.current({
              eventType: payload.eventType,
              new: (payload.new || {}) as Record<string, unknown>,
              old: (payload.old || {}) as Record<string, unknown>,
            });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[RealtimeNotifications] Subscription warning/error:", err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, recipientUserId]);
}
