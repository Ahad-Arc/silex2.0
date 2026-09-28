/**
 * SILEX Notifications — Server Functions & Authorization Boundary
 * 
 * Server-side notification persistence and mutation functions.
 * Enforces workspace access and user ownership isolation.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { getServerAuthContext } from "@/lib/supabase/server-context";
import { db } from "@/db";
import { notifications, notificationPreferences, workspaceMembers } from "@/db/schema";


export const getNotificationsInputSchema = z.object({
  workspaceId: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  unreadOnly: z.boolean().optional(),
});

export interface NotificationItem {
  id: string;
  workspaceId: string;
  recipientUserId: string;
  title: string;
  body: string;
  actionUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Server Function: getNotificationsFn
 * Retrieves user and workspace-scoped notifications list.
 */
export const getNotificationsFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getNotificationsInputSchema.parse(data || {}))
  .handler(
    async ({
      data,
    }): Promise<{ notifications: NotificationItem[]; unreadCount: number }> => {
      const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

      if (!db) {
        throw new Error("DATABASE_ERROR: Database client is uninitialized.");
      }

      const limit = data?.limit || 50;

      // Base query filtering strictly by workspace_id AND recipient_user_id
      const conditions = [
        eq(notifications.workspaceId, auth.workspaceId),
        eq(notifications.recipientUserId, auth.userId),
      ];

      if (data?.unreadOnly) {
        conditions.push(eq(notifications.isRead, false));
      }

      const notificationRows = await db
        .select({
          id: notifications.id,
          workspaceId: notifications.workspaceId,
          recipientUserId: notifications.recipientUserId,
          title: notifications.title,
          body: notifications.body,
          actionUrl: notifications.actionUrl,
          isRead: notifications.isRead,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      // Unread count
      const [unreadRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(
          and(
            eq(notifications.workspaceId, auth.workspaceId),
            eq(notifications.recipientUserId, auth.userId),
            eq(notifications.isRead, false)
          )
        );

      return {
        notifications: notificationRows,
        unreadCount: Number(unreadRow?.count || 0),
      };
    }
  );

export const markNotificationReadInputSchema = z.object({
  workspaceId: z.string().optional(),
  notificationId: z.string().min(1, "Notification ID is required"),
});

/**
 * Server Function: markNotificationReadFn
 * Marks a single notification as read after verifying workspace & recipient user ownership.
 */
export const markNotificationReadFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => markNotificationReadInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean; notificationId: string }> => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client is uninitialized.");
    }

    const [updatedRow] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.id, data.notificationId),
          eq(notifications.workspaceId, auth.workspaceId),
          eq(notifications.recipientUserId, auth.userId)
        )
      )
      .returning({ id: notifications.id });

    if (!updatedRow) {
      throw new Error(
        "NOTIFICATION_NOT_FOUND: Notification not found or unauthorized."
      );
    }

    return {
      success: true,
      notificationId: updatedRow.id,
    };
  });

export const markAllNotificationsReadInputSchema = z.object({
  workspaceId: z.string().optional(),
});

/**
 * Server Function: markAllNotificationsReadFn
 * Bulk marks all unread notifications as read for current user and workspace.
 */
export const markAllNotificationsReadFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => markAllNotificationsReadInputSchema.parse(data || {}))
  .handler(async ({ data }): Promise<{ success: boolean; updatedCount: number }> => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client is uninitialized.");
    }

    const updatedRows = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.workspaceId, auth.workspaceId),
          eq(notifications.recipientUserId, auth.userId),
          eq(notifications.isRead, false)
        )
      )
      .returning({ id: notifications.id });

    return {
      success: true,
      updatedCount: updatedRows.length,
    };
  });

export const createNotificationInputSchema = z.object({
  workspaceId: z.string().optional(),
  recipientUserId: z.string().min(1, "Recipient User ID is required"),
  title: z.string().min(1, "Title is required").max(255),
  body: z.string().min(1, "Body is required"),
  actionUrl: z.string().optional(),
});

/**
 * Server Function: createNotificationFn
 * Persists a new workspace notification after verifying recipient belongs to authorized workspace.
 */
export const createNotificationFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createNotificationInputSchema.parse(data))
  .handler(async ({ data }): Promise<NotificationItem> => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client is uninitialized.");
    }

    // Verify target recipient belongs to authorized workspace
    const [membership] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, auth.workspaceId),
          eq(workspaceMembers.userId, data.recipientUserId),
          eq(workspaceMembers.status, "active")
        )
      )
      .limit(1);

    if (!membership) {
      throw new Error(
        "INVALID_RECIPIENT: Recipient user does not belong to authorized workspace."
      );
    }

    const [createdRow] = await db
      .insert(notifications)
      .values({
        workspaceId: auth.workspaceId,
        recipientUserId: data.recipientUserId,
        title: data.title,
        body: data.body,
        actionUrl: data.actionUrl || null,
        isRead: false,
      })
      .returning();

    return {
      id: createdRow.id,
      workspaceId: createdRow.workspaceId,
      recipientUserId: createdRow.recipientUserId,
      title: createdRow.title,
      body: createdRow.body,
      actionUrl: createdRow.actionUrl,
      isRead: createdRow.isRead,
      readAt: createdRow.readAt,
      createdAt: createdRow.createdAt,
    };
  });

// ============================================================================
// Notification Preferences Schemas & Server Functions
// ============================================================================

export const DEFAULT_NOTIFICATION_EVENT_TYPES: Record<string, boolean> = {
  task_assigned: true,
  invoice_paid: true,
  client_created: true,
  comment_added: true,
  expense_recorded: true,
  ai_insight: true,
};

export interface NotificationPreferencesItem {
  id?: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  slackNotifications: boolean;
  eventTypes: Record<string, boolean>;
}

export const getNotificationPreferencesInputSchema = z.object({
  workspaceId: z.string().optional(),
});

/**
 * Server Function: getNotificationPreferencesFn
 * Retrieves user-scoped notification channel and event type preferences.
 * Self-only query strictly derived from server authentication context.
 */
export const getNotificationPreferencesFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getNotificationPreferencesInputSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<{ preferences: NotificationPreferencesItem }> => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = data?.workspaceId
      ? await requireWorkspaceAccess({ workspaceId: data.workspaceId })
      : await getServerAuthContext();

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client is uninitialized.");
    }

    const [row] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, auth.userId))
      .limit(1);

    if (!row) {
      return {
        preferences: {
          userId: auth.userId,
          emailNotifications: true,
          pushNotifications: true,
          slackNotifications: false,
          eventTypes: { ...DEFAULT_NOTIFICATION_EVENT_TYPES },
        },
      };
    }

    return {
      preferences: {
        id: row.id,
        userId: row.userId,
        emailNotifications: row.emailNotifications,
        pushNotifications: row.pushNotifications,
        slackNotifications: row.slackNotifications,
        eventTypes: {
          ...DEFAULT_NOTIFICATION_EVENT_TYPES,
          ...(row.eventTypes || {}),
        },
      },
    };
  });

export const updateNotificationPreferencesInputSchema = z.object({
  workspaceId: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  slackNotifications: z.boolean().optional(),
  eventTypes: z.record(z.string(), z.boolean()).optional(),
});

/**
 * Server Function: updateNotificationPreferencesFn
 * Validates and atomically upserts user notification delivery settings.
 * Self-only mutation strictly derived from server authentication context.
 */
export const updateNotificationPreferencesFn = createServerFn({ method: "POST" })
  .validator((data?: unknown) => updateNotificationPreferencesInputSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<{ success: boolean; preferences: NotificationPreferencesItem }> => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = data?.workspaceId
      ? await requireWorkspaceAccess({ workspaceId: data.workspaceId })
      : await getServerAuthContext();

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client is uninitialized.");
    }

    const [existingRow] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, auth.userId))
      .limit(1);

    let savedRow: typeof notificationPreferences.$inferSelect;

    if (existingRow) {
      const mergedEventTypes = data.eventTypes !== undefined
        ? {
            ...DEFAULT_NOTIFICATION_EVENT_TYPES,
            ...(existingRow.eventTypes || {}),
            ...data.eventTypes,
          }
        : undefined;

      const [updated] = await db
        .update(notificationPreferences)
        .set({
          ...(data.emailNotifications !== undefined ? { emailNotifications: data.emailNotifications } : {}),
          ...(data.pushNotifications !== undefined ? { pushNotifications: data.pushNotifications } : {}),
          ...(data.slackNotifications !== undefined ? { slackNotifications: data.slackNotifications } : {}),
          ...(mergedEventTypes !== undefined ? { eventTypes: mergedEventTypes } : {}),
        })
        .where(eq(notificationPreferences.userId, auth.userId))
        .returning();

      savedRow = updated;
    } else {
      const initialEventTypes = {
        ...DEFAULT_NOTIFICATION_EVENT_TYPES,
        ...(data.eventTypes || {}),
      };

      const [inserted] = await db
        .insert(notificationPreferences)
        .values({
          userId: auth.userId,
          emailNotifications: data.emailNotifications ?? true,
          pushNotifications: data.pushNotifications ?? true,
          slackNotifications: data.slackNotifications ?? false,
          eventTypes: initialEventTypes,
        })
        .returning();

      savedRow = inserted;
    }

    return {
      success: true,
      preferences: {
        id: savedRow.id,
        userId: savedRow.userId,
        emailNotifications: savedRow.emailNotifications,
        pushNotifications: savedRow.pushNotifications,
        slackNotifications: savedRow.slackNotifications,
        eventTypes: {
          ...DEFAULT_NOTIFICATION_EVENT_TYPES,
          ...(savedRow.eventTypes || {}),
        },
      },
    };
  });
