/**
 * SILEX Automation Workflow Engine — Action Registry
 * 
 * Bounded, type-safe, allowlisted action contracts and execution primitives.
 * Executes strictly under trusted server-side context (TrustedExecutionContext).
 */

import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  notifications,
  workspaceMembers,
  auditLogs,
  tasks,
  webhooks,
  webhookDeliveries,
} from "@/db/schema";

if (typeof window !== "undefined") {
  throw new Error(
    "CRITICAL SECURITY ERROR: Automation actions module must NEVER be loaded in client browser environments."
  );
}

/**
 * Trusted Execution Context Contract
 * Provided exclusively by trusted server-side caller (e.g. M5.3 execution engine).
 */
export interface TrustedExecutionContext {
  workspaceId: string;
  actorUserId?: string | null;
  event?: Record<string, unknown>;
  correlationId?: string;
}

export const trustedExecutionContextSchema = z.object({
  workspaceId: z.string().min(1, "Trusted workspaceId is required"),
  actorUserId: z.string().nullable().optional(),
  event: z.record(z.unknown()).optional(),
  correlationId: z.string().optional(),
});

/**
 * Allowlisted Action Types (ONLY 4)
 */
export const AUTOMATION_ACTION_TYPES = [
  "create_notification",
  "create_audit_log",
  "update_task_status",
  "dispatch_webhook",
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];
export const automationActionTypeSchema = z.enum(AUTOMATION_ACTION_TYPES);

/**
 * Action Schemas
 */
export const createNotificationActionSchema = z.object({
  type: z.literal("create_notification"),
  recipientUserId: z.string().min(1, "Recipient User ID is required"),
  title: z.string().min(1, "Title is required").max(255, "Title exceeds max length"),
  body: z.string().min(1, "Body is required").max(2000, "Body exceeds max length"),
  actionUrl: z.string().max(500, "Action URL exceeds max length").optional(),
});

export const createAuditLogActionSchema = z.object({
  type: z.literal("create_audit_log"),
  action: z.string().min(1, "Action name is required").max(100),
  entityType: z.string().min(1, "Entity type is required").max(50),
  entityId: z.string().min(1, "Entity ID is required"),
  oldValues: z.record(z.unknown()).optional(),
  newValues: z.record(z.unknown()).optional(),
});

export const updateTaskStatusActionSchema = z.object({
  type: z.literal("update_task_status"),
  taskId: z.string().min(1, "Task ID is required"),
  status: z.string().min(1, "Status is required").max(50),
});

export const dispatchWebhookActionSchema = z.object({
  type: z.literal("dispatch_webhook"),
  webhookId: z.string().min(1, "Webhook ID is required"),
  payload: z.record(z.unknown()).default({}),
});

export type CreateNotificationActionParams = z.infer<typeof createNotificationActionSchema>;
export type CreateAuditLogActionParams = z.infer<typeof createAuditLogActionSchema>;
export type UpdateTaskStatusActionParams = z.infer<typeof updateTaskStatusActionSchema>;
export type DispatchWebhookActionParams = z.infer<typeof dispatchWebhookActionSchema>;

export const automationActionParamsSchema = z.discriminatedUnion("type", [
  createNotificationActionSchema,
  createAuditLogActionSchema,
  updateTaskStatusActionSchema,
  dispatchWebhookActionSchema,
]);

export const automationActionSchema = automationActionParamsSchema;
export type AutomationActionParams = z.infer<typeof automationActionParamsSchema>;

/**
 * Action Execution Result Interface
 */
export interface ActionExecutionResult {
  success: boolean;
  actionType: AutomationActionType;
  result?: unknown;
  error?: string;
}

/**
 * Action Handler: create_notification
 */
async function executeCreateNotificationAction(
  params: CreateNotificationActionParams,
  context: TrustedExecutionContext,
  executor?: any
): Promise<ActionExecutionResult> {
  const ctx = trustedExecutionContextSchema.parse(context);
  const validated = createNotificationActionSchema.parse(params);

  const client = executor || db;
  if (!client) {
    throw new Error("DATABASE_ERROR: Database handle is uninitialized.");
  }

  // Verify target recipient user belongs to authorized workspace
  const [membership] = await client
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ctx.workspaceId),
        eq(workspaceMembers.userId, validated.recipientUserId),
        eq(workspaceMembers.status, "active")
      )
    )
    .limit(1);

  if (!membership) {
    throw new Error(
      "INVALID_RECIPIENT: Recipient user does not belong to the authorized workspace."
    );
  }

  const [createdRow] = await client
    .insert(notifications)
    .values({
      workspaceId: ctx.workspaceId, // Enforce trusted workspace context
      recipientUserId: validated.recipientUserId,
      title: validated.title,
      body: validated.body,
      actionUrl: validated.actionUrl || null,
      isRead: false,
    })
    .returning();

  return {
    success: true,
    actionType: "create_notification",
    result: {
      notificationId: createdRow.id,
      workspaceId: createdRow.workspaceId,
      recipientUserId: createdRow.recipientUserId,
    },
  };
}

/**
 * Action Handler: create_audit_log
 */
async function executeCreateAuditLogAction(
  params: CreateAuditLogActionParams,
  context: TrustedExecutionContext,
  executor?: any
): Promise<ActionExecutionResult> {
  const ctx = trustedExecutionContextSchema.parse(context);
  const validated = createAuditLogActionSchema.parse(params);

  const client = executor || db;
  if (!client) {
    throw new Error("DATABASE_ERROR: Database handle is uninitialized.");
  }

  const [createdRow] = await client
    .insert(auditLogs)
    .values({
      workspaceId: ctx.workspaceId, // Enforce trusted workspace context
      actorId: ctx.actorUserId || null, // Enforce trusted actor context
      action: validated.action,
      entityType: validated.entityType,
      entityId: validated.entityId,
      oldValues: validated.oldValues || null,
      newValues: validated.newValues || null,
    })
    .returning();

  return {
    success: true,
    actionType: "create_audit_log",
    result: {
      auditLogId: createdRow.id,
      workspaceId: createdRow.workspaceId,
      action: createdRow.action,
    },
  };
}

/**
 * Action Handler: update_task_status
 */
async function executeUpdateTaskStatusAction(
  params: UpdateTaskStatusActionParams,
  context: TrustedExecutionContext,
  executor?: any
): Promise<ActionExecutionResult> {
  const ctx = trustedExecutionContextSchema.parse(context);
  const validated = updateTaskStatusActionSchema.parse(params);

  const client = executor || db;
  if (!client) {
    throw new Error("DATABASE_ERROR: Database handle is uninitialized.");
  }

  // Verify task exists in the trusted workspace
  const [taskRow] = await client
    .select({ id: tasks.id, status: tasks.status })
    .from(tasks)
    .where(
      and(
        eq(tasks.id, validated.taskId),
        eq(tasks.workspaceId, ctx.workspaceId), // Enforce workspace boundary
        isNull(tasks.deletedAt)
      )
    )
    .limit(1);

  if (!taskRow) {
    throw new Error(
      "TASK_NOT_FOUND: Target task does not exist or does not belong to authorized workspace."
    );
  }

  const isCompletedTransition =
    (validated.status === "completed" || validated.status === "done") &&
    taskRow.status !== "completed" &&
    taskRow.status !== "done";

  const [updatedRow] = await client
    .update(tasks)
    .set({
      status: validated.status,
      completedAt: isCompletedTransition ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tasks.id, validated.taskId),
        eq(tasks.workspaceId, ctx.workspaceId)
      )
    )
    .returning();

  return {
    success: true,
    actionType: "update_task_status",
    result: {
      taskId: updatedRow.id,
      workspaceId: updatedRow.workspaceId,
      previousStatus: taskRow.status,
      newStatus: updatedRow.status,
    },
  };
}

/**
 * Action Handler: dispatch_webhook
 * M5.2/M5.3: Validates webhook ownership, payload bounds, and builds dispatch intent descriptor.
 * DOES NOT execute fetch() or network HTTP requests.
 */
async function executeDispatchWebhookAction(
  params: DispatchWebhookActionParams,
  context: TrustedExecutionContext,
  executor?: any
): Promise<ActionExecutionResult> {
  const ctx = trustedExecutionContextSchema.parse(context);
  const validated = dispatchWebhookActionSchema.parse(params);

  const client = executor || db;
  if (!client) {
    throw new Error("DATABASE_ERROR: Database handle is uninitialized.");
  }

  // Verify target webhook exists and belongs to the trusted workspace
  const [webhookRow] = await client
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.id, validated.webhookId),
        eq(webhooks.workspaceId, ctx.workspaceId), // Enforce workspace boundary
        eq(webhooks.isActive, true)
      )
    )
    .limit(1);

  if (!webhookRow) {
    throw new Error(
      "WEBHOOK_NOT_FOUND: Target webhook does not exist, is inactive, or does not belong to authorized workspace."
    );
  }

  // Payload size limit check (max 16KB JSON serialization)
  const serialized = JSON.stringify(validated.payload || {});
  if (serialized.length > 16384) {
    throw new Error(
      "PAYLOAD_TOO_LARGE: Webhook payload exceeds maximum allowable size of 16KB."
    );
  }

  // Enqueue webhook delivery intent into webhook_deliveries table atomically
  const eventId = (ctx.event?.id as string) || ctx.correlationId || "unknown";

  const [deliveryRow] = await client
    .insert(webhookDeliveries)
    .values({
      workspaceId: webhookRow.workspaceId,
      webhookId: webhookRow.id,
      eventId: eventId,
      status: "pending",
      attemptedAt: new Date(),
      claimedAt: null,
      retryCount: 0,
      nextRetryAt: null,
      errorMessage: null,
    })
    .returning();

  if (!deliveryRow?.id) {
    throw new Error(
      "DATABASE_ERROR: Failed to persist webhook delivery intent record."
    );
  }

  const deliveryId = deliveryRow.id;

  return {
    success: true,
    actionType: "dispatch_webhook",
    result: {
      deliveryId,
      dispatchIntent: {
        deliveryId,
        webhookId: webhookRow.id,
        workspaceId: webhookRow.workspaceId,
        targetUrl: webhookRow.targetUrl,
        payload: validated.payload,
        queued: true,
      },
    },
  };
}

/**
 * Action Registry Allowlist Map
 */
export const ACTION_REGISTRY = {
  create_notification: {
    type: "create_notification" as const,
    schema: createNotificationActionSchema,
    handler: executeCreateNotificationAction,
  },
  create_audit_log: {
    type: "create_audit_log" as const,
    schema: createAuditLogActionSchema,
    handler: executeCreateAuditLogAction,
  },
  update_task_status: {
    type: "update_task_status" as const,
    schema: updateTaskStatusActionSchema,
    handler: executeUpdateTaskStatusAction,
  },
  dispatch_webhook: {
    type: "dispatch_webhook" as const,
    schema: dispatchWebhookActionSchema,
    handler: executeDispatchWebhookAction,
  },
} as const;

/**
 * Retrieves a registered action contract by name or throws a structured validation error.
 */
export function getRegisteredAction(type: string) {
  const actionKey = type as AutomationActionType;
  const registered = ACTION_REGISTRY[actionKey];
  if (!registered) {
    throw new Error(
      `UNREGISTERED_ACTION: Action type "${type}" is not registered in allowlist.`
    );
  }
  return registered;
}

/**
 * Executes a registered action against trusted context.
 */
export async function executeAutomationAction(
  params: AutomationActionParams,
  context: TrustedExecutionContext,
  executor?: any
): Promise<ActionExecutionResult> {
  const parsedParams = automationActionParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    throw new Error(
      `INVALID_ACTION_PARAMS: Action parameters validation failed. ${parsedParams.error.message}`
    );
  }

  const registered = getRegisteredAction(parsedParams.data.type);
  return await registered.handler(parsedParams.data as any, context, executor);
}
