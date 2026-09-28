/**
 * SILEX Automation Workflow Engine — Server Functions & Authorization Boundary
 * 
 * Production server functions for Automation Rule CRUD, Execution Run History,
 * Webhook Endpoint Management, Webhook Delivery History, and Secure Worker Triggers.
 * 
 * Enforces server authentication context, strict workspace multi-tenant isolation,
 * Zod parameter validation, allowlisted action registry validation, SSRF target URL checks,
 * HMAC secret protection, and compliance audit logging.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/auth/workspace";
import { db } from "@/db";
import {
  automationRules,
  automationRuns,
  webhooks,
  webhookDeliveries,
  auditLogs,
} from "@/db/schema";
import { automationActionSchema, type AutomationActionParams } from "@/lib/automation/actions";
import { validateWebhookTargetUrl } from "@/lib/automation/webhooks";
import { processOutboxBatchFn } from "@/lib/automation/processor";
import { processWebhookDeliveryBatchFn } from "@/lib/automation/dispatcher";


/**
 * Utility: Generates a cryptographically secure 32-byte (64 hex char) webhook secret
 */
function generateSecureWebhookSecret(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  try {
    const nodeCrypto = require("node:crypto");
    return nodeCrypto.randomBytes(32).toString("hex");
  } catch (e) {
    throw new Error("CRYPTOGRAPHIC_ERROR: Failed to generate secure random bytes for webhook secret.");
  }
}

/**
 * Utility: Recursively sanitizes execution logs to strip any sensitive token, secret, or password fields
 */
export function sanitizeExecutionLogs(logs: unknown): unknown {
  if (!logs) return [];
  if (typeof logs === "string") return logs;
  if (Array.isArray(logs)) {
    return logs.map((item) => sanitizeExecutionLogs(item));
  }
  if (typeof logs === "object" && logs !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(logs as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("secret") ||
        lowerKey.includes("password") ||
        lowerKey.includes("token") ||
        lowerKey.includes("authorization") ||
        lowerKey.includes("apikey") ||
        lowerKey.includes("api_key") ||
        lowerKey.includes("hmac")
      ) {
        sanitized[key] = "[REDACTED_SENSITIVE]";
      } else {
        sanitized[key] = sanitizeExecutionLogs(value);
      }
    }
    return sanitized;
  }
  return logs;
}

/* ============================================================================
   1. AUTOMATION RULE CRUD SERVER FUNCTIONS
   ============================================================================ */

export const getAutomationRulesInputSchema = z.object({
  workspaceId: z.string().optional(),
  isEnabled: z.boolean().optional(),
});

export interface AutomationRuleItem {
  id: string;
  workspaceId: string;
  name: string;
  triggerEvent: string;
  conditions: any[];
  actions: any[];
  isEnabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Server Function 1: getAutomationRulesFn
 * List all automation rules for the authorized workspace.
 * Allowed roles: member, admin, owner
 */
export const getAutomationRulesFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getAutomationRulesInputSchema.parse(data || {}))
  .handler(async ({ data }): Promise<{ rules: AutomationRuleItem[] }> => {
    const auth = await requireWorkspaceAccess({
      workspaceId: data?.workspaceId,
      requiredRole: "member",
    });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
    }

    const conditions = [eq(automationRules.workspaceId, auth.workspaceId)];
    if (data?.isEnabled !== undefined) {
      conditions.push(eq(automationRules.isEnabled, data.isEnabled));
    }

    const rows = await db
      .select({
        id: automationRules.id,
        workspaceId: automationRules.workspaceId,
        name: automationRules.name,
        triggerEvent: automationRules.triggerEvent,
        conditions: automationRules.conditions,
        actions: automationRules.actions,
        isEnabled: automationRules.isEnabled,
        createdBy: automationRules.createdBy,
        createdAt: automationRules.createdAt,
        updatedAt: automationRules.updatedAt,
      })
      .from(automationRules)
      .where(and(...conditions))
      .orderBy(desc(automationRules.createdAt));

    return {
      rules: rows.map((r) => ({
        ...r,
        conditions: (r.conditions as Array<Record<string, unknown>>) || [],
        actions: (r.actions as Array<Record<string, unknown>>) || [],
      })),
    };
  });

export const getAutomationRuleByIdInputSchema = z.object({
  workspaceId: z.string().optional(),
  ruleId: z.string().min(1, "Rule ID is required"),
});

/**
 * Server Function 2: getAutomationRuleByIdFn
 * Fetch a single automation rule by ID within authorized workspace.
 * Allowed roles: member, admin, owner
 */
export const getAutomationRuleByIdFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getAutomationRuleByIdInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ rule: AutomationRuleItem }> => {
    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "member",
    });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
    }

    const [rule] = await db
      .select({
        id: automationRules.id,
        workspaceId: automationRules.workspaceId,
        name: automationRules.name,
        triggerEvent: automationRules.triggerEvent,
        conditions: automationRules.conditions,
        actions: automationRules.actions,
        isEnabled: automationRules.isEnabled,
        createdBy: automationRules.createdBy,
        createdAt: automationRules.createdAt,
        updatedAt: automationRules.updatedAt,
      })
      .from(automationRules)
      .where(
        and(
          eq(automationRules.id, data.ruleId),
          eq(automationRules.workspaceId, auth.workspaceId)
        )
      )
      .limit(1);

    if (!rule) {
      throw new Error("NOT_FOUND: Automation rule not found or access denied.");
    }

    return {
      rule: {
        ...rule,
        conditions: (rule.conditions as Array<Record<string, unknown>>) || [],
        actions: (rule.actions as Array<Record<string, unknown>>) || [],
      },
    };
  });

export const createAutomationRuleInputSchema = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1, "Rule name is required").max(255),
  triggerEvent: z.string().min(1, "Trigger event is required").max(100),
  conditions: z.array(z.record(z.unknown())).default([]),
  actions: z.array(automationActionSchema).min(1, "At least one action is required"),
  isEnabled: z.boolean().default(true),
});

/**
 * Server Function 3: createAutomationRuleFn
 * Creates a new automation rule after validating actions against allowlist schema.
 * Allowed roles: admin, owner
 */
export const createAutomationRuleFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createAutomationRuleInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ rule: AutomationRuleItem }> => {
    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (auth.memberRole !== "admin" && auth.memberRole !== "owner") {
      throw new WorkspaceAccessError(
        "UNAUTHORIZED_WORKSPACE",
        "Permission denied. Only workspace admins or owners may create automation rules."
      );
    }

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
    }

    const [createdRule] = await db
      .insert(automationRules)
      .values({
        workspaceId: auth.workspaceId,
        name: data.name,
        triggerEvent: data.triggerEvent,
        conditions: data.conditions,
        actions: data.actions as Array<Record<string, unknown>>,
        isEnabled: data.isEnabled,
        createdBy: auth.userId,
      })
      .returning();

    // Compliance audit trail
    await db.insert(auditLogs).values({
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: "automation_rule.created",
      entityType: "automation_rule",
      entityId: createdRule.id,
      newValues: {
        name: createdRule.name,
        triggerEvent: createdRule.triggerEvent,
        isEnabled: createdRule.isEnabled,
        actionsCount: data.actions.length,
      },
    });

    return {
      rule: {
        ...createdRule,
        conditions: (createdRule.conditions as Array<Record<string, unknown>>) || [],
        actions: (createdRule.actions as Array<Record<string, unknown>>) || [],
      },
    };
  });

export const updateAutomationRuleInputSchema = z.object({
  workspaceId: z.string().optional(),
  ruleId: z.string().min(1, "Rule ID is required"),
  name: z.string().min(1).max(255).optional(),
  triggerEvent: z.string().min(1).max(100).optional(),
  conditions: z.array(z.record(z.unknown())).optional(),
  actions: z.array(automationActionSchema).min(1).optional(),
  isEnabled: z.boolean().optional(),
});

/**
 * Server Function 4: updateAutomationRuleFn
 * Updates an existing automation rule within authorized workspace.
 * Allowed roles: admin, owner
 */
export const updateAutomationRuleFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateAutomationRuleInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ rule: AutomationRuleItem }> => {
    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (auth.memberRole !== "admin" && auth.memberRole !== "owner") {
      throw new WorkspaceAccessError(
        "UNAUTHORIZED_WORKSPACE",
        "Permission denied. Only workspace admins or owners may update automation rules."
      );
    }

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
    }

    const [existingRule] = await db
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.id, data.ruleId),
          eq(automationRules.workspaceId, auth.workspaceId)
        )
      )
      .limit(1);

    if (!existingRule) {
      throw new Error("NOT_FOUND: Automation rule not found or access denied.");
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.triggerEvent !== undefined) updatePayload.triggerEvent = data.triggerEvent;
    if (data.conditions !== undefined) updatePayload.conditions = data.conditions;
    if (data.actions !== undefined) updatePayload.actions = data.actions;
    if (data.isEnabled !== undefined) updatePayload.isEnabled = data.isEnabled;

    const [updatedRule] = await db
      .update(automationRules)
      .set(updatePayload)
      .where(
        and(
          eq(automationRules.id, data.ruleId),
          eq(automationRules.workspaceId, auth.workspaceId)
        )
      )
      .returning();

    // Compliance audit trail
    await db.insert(auditLogs).values({
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: "automation_rule.updated",
      entityType: "automation_rule",
      entityId: updatedRule.id,
      oldValues: {
        name: existingRule.name,
        triggerEvent: existingRule.triggerEvent,
        isEnabled: existingRule.isEnabled,
      },
      newValues: {
        name: updatedRule.name,
        triggerEvent: updatedRule.triggerEvent,
        isEnabled: updatedRule.isEnabled,
      },
    });

    return {
      rule: {
        ...updatedRule,
        conditions: (updatedRule.conditions as Array<Record<string, unknown>>) || [],
        actions: (updatedRule.actions as Array<Record<string, unknown>>) || [],
      },
    };
  });

export const toggleAutomationRuleInputSchema = z.object({
  workspaceId: z.string().optional(),
  ruleId: z.string().min(1, "Rule ID is required"),
  isEnabled: z.boolean(),
});

/**
 * Server Function 5: toggleAutomationRuleFn
 * Enable or disable an automation rule.
 * Allowed roles: admin, owner
 */
export const toggleAutomationRuleFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => toggleAutomationRuleInputSchema.parse(data))
  .handler(
    async ({ data }): Promise<{ success: boolean; ruleId: string; isEnabled: boolean }> => {
      const auth = await requireWorkspaceAccess({
        workspaceId: data.workspaceId,
        requiredRole: "admin",
      });

      if (auth.memberRole !== "admin" && auth.memberRole !== "owner") {
        throw new WorkspaceAccessError(
          "UNAUTHORIZED_WORKSPACE",
          "Permission denied. Only workspace admins or owners may toggle automation rules."
        );
      }

      if (!db) {
        throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
      }

      const [existingRule] = await db
        .select()
        .from(automationRules)
        .where(
          and(
            eq(automationRules.id, data.ruleId),
            eq(automationRules.workspaceId, auth.workspaceId)
          )
        )
        .limit(1);

      if (!existingRule) {
        throw new Error("NOT_FOUND: Automation rule not found or access denied.");
      }

      const [updatedRule] = await db
        .update(automationRules)
        .set({
          isEnabled: data.isEnabled,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(automationRules.id, data.ruleId),
            eq(automationRules.workspaceId, auth.workspaceId)
          )
        )
        .returning({ id: automationRules.id, isEnabled: automationRules.isEnabled });

      // Audit transition
      await db.insert(auditLogs).values({
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: "automation_rule.toggled",
        entityType: "automation_rule",
        entityId: updatedRule.id,
        oldValues: { isEnabled: existingRule.isEnabled },
        newValues: { isEnabled: updatedRule.isEnabled },
      });

      return {
        success: true,
        ruleId: updatedRule.id,
        isEnabled: updatedRule.isEnabled,
      };
    }
  );

export const deleteAutomationRuleInputSchema = z.object({
  workspaceId: z.string().optional(),
  ruleId: z.string().min(1, "Rule ID is required"),
});

/**
 * Server Function 6: deleteAutomationRuleFn
 * Permanently deletes an automation rule within authorized workspace.
 * Allowed roles: admin, owner
 */
export const deleteAutomationRuleFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteAutomationRuleInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean; ruleId: string }> => {
    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (auth.memberRole !== "admin" && auth.memberRole !== "owner") {
      throw new WorkspaceAccessError(
        "UNAUTHORIZED_WORKSPACE",
        "Permission denied. Only workspace admins or owners may delete automation rules."
      );
    }

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
    }

    const [existingRule] = await db
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.id, data.ruleId),
          eq(automationRules.workspaceId, auth.workspaceId)
        )
      )
      .limit(1);

    if (!existingRule) {
      throw new Error("NOT_FOUND: Automation rule not found or access denied.");
    }

    await db
      .delete(automationRules)
      .where(
        and(
          eq(automationRules.id, data.ruleId),
          eq(automationRules.workspaceId, auth.workspaceId)
        )
      );

    // Audit log
    await db.insert(auditLogs).values({
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: "automation_rule.deleted",
      entityType: "automation_rule",
      entityId: data.ruleId,
      oldValues: { name: existingRule.name, triggerEvent: existingRule.triggerEvent },
    });

    return {
      success: true,
      ruleId: data.ruleId,
    };
  });

/* ============================================================================
   2. AUTOMATION HISTORY SERVER FUNCTIONS
   ============================================================================ */

export const getAutomationRunsInputSchema = z.object({
  workspaceId: z.string().optional(),
  ruleId: z.string().optional(),
  status: z.enum(["completed", "skipped", "failed"]).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export interface AutomationRunItem {
  id: string;
  workspaceId: string;
  ruleId: string;
  ruleName?: string;
  outboxEventId: string | null;
  status: string;
  logs: any;
  executedAt: Date;
}

/**
 * Server Function 7: getAutomationRunsFn
 * List execution history runs for authorized workspace with pagination.
 * Allowed roles: member, admin, owner
 */
export const getAutomationRunsFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getAutomationRunsInputSchema.parse(data || {}))
  .handler(
    async ({
      data,
    }): Promise<{ runs: AutomationRunItem[]; totalCount: number }> => {
      const auth = await requireWorkspaceAccess({
        workspaceId: data?.workspaceId,
        requiredRole: "member",
      });

      if (!db) {
        throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
      }

      const limit = Math.min(Math.max(1, data?.limit || 20), 100);
      const offset = Math.max(0, data?.offset || 0);

      const conditions = [eq(automationRuns.workspaceId, auth.workspaceId)];
      if (data?.ruleId) {
        conditions.push(eq(automationRuns.ruleId, data.ruleId));
      }
      if (data?.status) {
        conditions.push(eq(automationRuns.status, data.status));
      }

      const runRows = await db
        .select({
          id: automationRuns.id,
          workspaceId: automationRuns.workspaceId,
          ruleId: automationRuns.ruleId,
          ruleName: automationRules.name,
          outboxEventId: automationRuns.outboxEventId,
          status: automationRuns.status,
          logs: automationRuns.logs,
          executedAt: automationRuns.executedAt,
        })
        .from(automationRuns)
        .leftJoin(automationRules, eq(automationRules.id, automationRuns.ruleId))
        .where(and(...conditions))
        .orderBy(desc(automationRuns.executedAt))
        .limit(limit)
        .offset(offset);

      const [totalRow] = await db
        .select({ count: count() })
        .from(automationRuns)
        .where(and(...conditions));

      const sanitizedRuns: AutomationRunItem[] = runRows.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        ruleId: r.ruleId,
        ruleName: r.ruleName || undefined,
        outboxEventId: r.outboxEventId,
        status: r.status,
        logs: sanitizeExecutionLogs(r.logs),
        executedAt: r.executedAt,
      }));

      return {
        runs: sanitizedRuns,
        totalCount: Number(totalRow?.count || 0),
      };
    }
  );

export const getAutomationRunByIdInputSchema = z.object({
  workspaceId: z.string().optional(),
  runId: z.string().min(1, "Run ID is required"),
});

/**
 * Server Function 8: getAutomationRunByIdFn
 * Fetch single execution run details by ID for authorized workspace.
 * Allowed roles: member, admin, owner
 */
export const getAutomationRunByIdFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getAutomationRunByIdInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ run: AutomationRunItem }> => {
    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "member",
    });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
    }

    const [run] = await db
      .select({
        id: automationRuns.id,
        workspaceId: automationRuns.workspaceId,
        ruleId: automationRuns.ruleId,
        ruleName: automationRules.name,
        outboxEventId: automationRuns.outboxEventId,
        status: automationRuns.status,
        logs: automationRuns.logs,
        executedAt: automationRuns.executedAt,
      })
      .from(automationRuns)
      .leftJoin(automationRules, eq(automationRules.id, automationRuns.ruleId))
      .where(
        and(
          eq(automationRuns.id, data.runId),
          eq(automationRuns.workspaceId, auth.workspaceId)
        )
      )
      .limit(1);

    if (!run) {
      throw new Error("NOT_FOUND: Automation run log not found or access denied.");
    }

    return {
      run: {
        id: run.id,
        workspaceId: run.workspaceId,
        ruleId: run.ruleId,
        ruleName: run.ruleName || undefined,
        outboxEventId: run.outboxEventId,
        status: run.status,
        logs: sanitizeExecutionLogs(run.logs),
        executedAt: run.executedAt,
      },
    };
  });

/* ============================================================================
   3. WEBHOOK MANAGEMENT SERVER FUNCTIONS
   ============================================================================ */

export const getWebhooksInputSchema = z.object({
  workspaceId: z.string().optional(),
});

export interface WebhookPublicItem {
  id: string;
  workspaceId: string;
  targetUrl: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdAt: Date;
}
export type WebhookItem = WebhookPublicItem;

/**
 * Server Function 9: getWebhooksFn
 * List registered webhooks for workspace.
 * Allowed roles: admin, owner ONLY.
 * SECRET AUTHORITY: webhooks.secret is strictly EXCLUDED from query select.
 */
export const getWebhooksFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getWebhooksInputSchema.parse(data || {}))
  .handler(async ({ data }): Promise<{ webhooks: WebhookPublicItem[] }> => {
    const auth = await requireWorkspaceAccess({
      workspaceId: data?.workspaceId,
      requiredRole: "admin",
    });

    if (auth.memberRole !== "admin" && auth.memberRole !== "owner") {
      throw new WorkspaceAccessError(
        "UNAUTHORIZED_WORKSPACE",
        "Permission denied. Only workspace admins or owners may view webhooks."
      );
    }

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
    }

    // EXPLICIT COLUMN SELECT — NEVER SELECT webhooks.secret
    const rows = await db
      .select({
        id: webhooks.id,
        workspaceId: webhooks.workspaceId,
        targetUrl: webhooks.targetUrl,
        subscribedEvents: webhooks.subscribedEvents,
        isActive: webhooks.isActive,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(eq(webhooks.workspaceId, auth.workspaceId))
      .orderBy(desc(webhooks.createdAt));

    return {
      webhooks: rows.map((r) => ({
        ...r,
        subscribedEvents: (r.subscribedEvents as string[]) || [],
      })),
    };
  });

export const createWebhookInputSchema = z.object({
  workspaceId: z.string().optional(),
  targetUrl: z.string().url("Invalid target URL format"),
  subscribedEvents: z.array(z.string()).default([]),
});

/**
 * Server Function 10: createWebhookFn
 * Register new webhook endpoint with SSRF target URL validation and auto-generated secret.
 * Allowed roles: admin, owner ONLY.
 * SECRET AUTHORITY: Secret is returned ONLY ONCE in this creation response.
 */
export const createWebhookFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createWebhookInputSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ webhook: WebhookPublicItem; secret: string }> => {
      const auth = await requireWorkspaceAccess({
        workspaceId: data.workspaceId,
        requiredRole: "admin",
      });

      if (auth.memberRole !== "admin" && auth.memberRole !== "owner") {
        throw new WorkspaceAccessError(
          "UNAUTHORIZED_WORKSPACE",
          "Permission denied. Only workspace admins or owners may create webhooks."
        );
      }

      if (!db) {
        throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
      }

      // Pre-flight SSRF Validation
      const urlValidation = validateWebhookTargetUrl(data.targetUrl);
      if (!urlValidation.valid) {
        throw new Error(
          urlValidation.reason || "SSRF_VALIDATION_FAILED: Target URL is rejected."
        );
      }

      const generatedSecret = generateSecureWebhookSecret();

      const [created] = await db
        .insert(webhooks)
        .values({
          workspaceId: auth.workspaceId,
          targetUrl: data.targetUrl,
          secret: generatedSecret,
          subscribedEvents: data.subscribedEvents,
          isActive: true,
        })
        .returning({
          id: webhooks.id,
          workspaceId: webhooks.workspaceId,
          targetUrl: webhooks.targetUrl,
          subscribedEvents: webhooks.subscribedEvents,
          isActive: webhooks.isActive,
          createdAt: webhooks.createdAt,
        });

      // Audit log (secret excluded!)
      await db.insert(auditLogs).values({
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: "webhook.created",
        entityType: "webhook",
        entityId: created.id,
        newValues: {
          targetUrl: created.targetUrl,
          subscribedEvents: created.subscribedEvents,
        },
      });

      return {
        webhook: {
          ...created,
          subscribedEvents: (created.subscribedEvents as string[]) || [],
        },
        secret: generatedSecret,
      };
    }
  );

export const updateWebhookInputSchema = z.object({
  workspaceId: z.string().optional(),
  webhookId: z.string().min(1, "Webhook ID is required"),
  targetUrl: z.string().url("Invalid target URL format").optional(),
  subscribedEvents: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Server Function 11: updateWebhookFn
 * Updates safe configuration fields on an existing webhook endpoint.
 * Allowed roles: admin, owner ONLY.
 */
export const updateWebhookFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateWebhookInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ webhook: WebhookPublicItem }> => {
    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (auth.memberRole !== "admin" && auth.memberRole !== "owner") {
      throw new WorkspaceAccessError(
        "UNAUTHORIZED_WORKSPACE",
        "Permission denied. Only workspace admins or owners may update webhooks."
      );
    }

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
    }

    const [existing] = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.id, data.webhookId),
          eq(webhooks.workspaceId, auth.workspaceId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new Error("NOT_FOUND: Webhook not found or access denied.");
    }

    if (data.targetUrl) {
      const urlValidation = validateWebhookTargetUrl(data.targetUrl);
      if (!urlValidation.valid) {
        throw new Error(
          urlValidation.reason || "SSRF_VALIDATION_FAILED: Updated target URL is rejected."
        );
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (data.targetUrl !== undefined) updatePayload.targetUrl = data.targetUrl;
    if (data.subscribedEvents !== undefined) updatePayload.subscribedEvents = data.subscribedEvents;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

    const [updated] = await db
      .update(webhooks)
      .set(updatePayload)
      .where(
        and(
          eq(webhooks.id, data.webhookId),
          eq(webhooks.workspaceId, auth.workspaceId)
        )
      )
      .returning({
        id: webhooks.id,
        workspaceId: webhooks.workspaceId,
        targetUrl: webhooks.targetUrl,
        subscribedEvents: webhooks.subscribedEvents,
        isActive: webhooks.isActive,
        createdAt: webhooks.createdAt,
      });

    // Audit log
    await db.insert(auditLogs).values({
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: "webhook.updated",
      entityType: "webhook",
      entityId: updated.id,
      oldValues: { targetUrl: existing.targetUrl, isActive: existing.isActive },
      newValues: { targetUrl: updated.targetUrl, isActive: updated.isActive },
    });

    return {
      webhook: {
        ...updated,
        subscribedEvents: (updated.subscribedEvents as string[]) || [],
      },
    };
  });

export const deleteWebhookInputSchema = z.object({
  workspaceId: z.string().optional(),
  webhookId: z.string().min(1, "Webhook ID is required"),
});

/**
 * Server Function 12: deleteWebhookFn
 * Removes a registered webhook endpoint.
 * Allowed roles: admin, owner ONLY.
 */
export const deleteWebhookFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteWebhookInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean; webhookId: string }> => {
    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (auth.memberRole !== "admin" && auth.memberRole !== "owner") {
      throw new WorkspaceAccessError(
        "UNAUTHORIZED_WORKSPACE",
        "Permission denied. Only workspace admins or owners may delete webhooks."
      );
    }

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
    }

    const [existing] = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.id, data.webhookId),
          eq(webhooks.workspaceId, auth.workspaceId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new Error("NOT_FOUND: Webhook not found or access denied.");
    }

    await db
      .delete(webhooks)
      .where(
        and(
          eq(webhooks.id, data.webhookId),
          eq(webhooks.workspaceId, auth.workspaceId)
        )
      );

    // Audit log
    await db.insert(auditLogs).values({
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: "webhook.deleted",
      entityType: "webhook",
      entityId: data.webhookId,
      oldValues: { targetUrl: existing.targetUrl },
    });

    return {
      success: true,
      webhookId: data.webhookId,
    };
  });

export const getWebhookDeliveriesInputSchema = z.object({
  workspaceId: z.string().optional(),
  webhookId: z.string().optional(),
  status: z.enum(["pending", "processing", "delivered", "failed"]).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export interface WebhookDeliveryItem {
  id: string;
  workspaceId: string;
  webhookId: string;
  targetUrl?: string;
  eventId: string;
  responseStatusCode: number | null;
  responseBody: string | null;
  executionDurationMs: number | null;
  status: string;
  attemptedAt: Date;
  claimedAt: Date | null;
  retryCount: number;
  nextRetryAt: Date | null;
  errorMessage: string | null;
}

/**
 * Server Function 13: getWebhookDeliveriesFn
 * List delivery history for authorized workspace.
 * Allowed roles: admin, owner ONLY.
 * SECRET AUTHORITY: Never returns webhooks.secret.
 */
export const getWebhookDeliveriesFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getWebhookDeliveriesInputSchema.parse(data || {}))
  .handler(
    async ({
      data,
    }): Promise<{ deliveries: WebhookDeliveryItem[]; totalCount: number }> => {
      const auth = await requireWorkspaceAccess({
        workspaceId: data?.workspaceId,
        requiredRole: "admin",
      });

      if (auth.memberRole !== "admin" && auth.memberRole !== "owner") {
        throw new WorkspaceAccessError(
          "UNAUTHORIZED_WORKSPACE",
          "Permission denied. Only workspace admins or owners may view delivery history."
        );
      }

      if (!db) {
        throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
      }

      const limit = Math.min(Math.max(1, data?.limit || 20), 100);
      const offset = Math.max(0, data?.offset || 0);

      const conditions = [eq(webhookDeliveries.workspaceId, auth.workspaceId)];
      if (data?.webhookId) {
        conditions.push(eq(webhookDeliveries.webhookId, data.webhookId));
      }
      if (data?.status) {
        conditions.push(eq(webhookDeliveries.status, data.status));
      }

      const rows = await db
        .select({
          id: webhookDeliveries.id,
          workspaceId: webhookDeliveries.workspaceId,
          webhookId: webhookDeliveries.webhookId,
          targetUrl: webhooks.targetUrl,
          eventId: webhookDeliveries.eventId,
          responseStatusCode: webhookDeliveries.responseStatusCode,
          responseBody: webhookDeliveries.responseBody,
          executionDurationMs: webhookDeliveries.executionDurationMs,
          status: webhookDeliveries.status,
          attemptedAt: webhookDeliveries.attemptedAt,
          claimedAt: webhookDeliveries.claimedAt,
          retryCount: webhookDeliveries.retryCount,
          nextRetryAt: webhookDeliveries.nextRetryAt,
          errorMessage: webhookDeliveries.errorMessage,
        })
        .from(webhookDeliveries)
        .leftJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
        .where(and(...conditions))
        .orderBy(desc(webhookDeliveries.attemptedAt))
        .limit(limit)
        .offset(offset);

      const [totalRow] = await db
        .select({ count: count() })
        .from(webhookDeliveries)
        .where(and(...conditions));

      return {
        deliveries: rows.map((r) => ({
          ...r,
          targetUrl: r.targetUrl || undefined,
        })),
        totalCount: Number(totalRow?.count || 0),
      };
    }
  );

/**
 * Utility: Constant-time string comparison to prevent timing side-channel attacks on secret tokens
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Utility: Verifies Authorization: Bearer <CRON_SECRET> header against process.env.CRON_SECRET
 */
export function verifyWorkerCronAuthorization(requestAuthHeader?: string | null): boolean {
  const envCronSecret = process.env.CRON_SECRET;
  if (!envCronSecret || envCronSecret.trim().length === 0) {
    return false;
  }

  let authHeader = requestAuthHeader;
  if (!authHeader && typeof globalThis !== "undefined") {
    const g = globalThis as Record<string, unknown>;
    const getHeader = (g.__silex_getRequestHeader || g.getRequestHeader) as
      | ((name: string) => string | undefined)
      | undefined;
    if (typeof getHeader === "function") {
      try {
        authHeader = getHeader("authorization") || getHeader("Authorization");
      } catch {
        // Outside active Start server request context (e.g. CLI, tests)
      }
    }
  }

  if (!authHeader || typeof authHeader !== "string") {
    return false;
  }

  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return false;
  }

  const token = trimmed.slice(7).trim();
  if (token.length === 0) return false;

  return timingSafeEqualStrings(token, envCronSecret.trim());
}

/* ============================================================================
   4. WORKER TRIGGER SERVER FUNCTIONS
   ============================================================================ */

export const triggerAutomationOutboxWorkerInputSchema = z.object({
  workspaceId: z.string().optional(),
  batchSize: z.number().min(1, "Batch size must be at least 1").max(100, "Batch size cannot exceed 100").default(10),
});

/**
 * Server Function 14: triggerAutomationOutboxWorkerFn
 * Triggers batch processing of pending outbox events.
 * Authorization: Valid bearer `CRON_SECRET` header OR authenticated workspace Admin/Owner.
 */
export const triggerAutomationOutboxWorkerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => triggerAutomationOutboxWorkerInputSchema.parse(data || {}))
  .handler(
    async ({
      data,
    }): Promise<{
      claimedCount: number;
      processedCount: number;
      failedCount: number;
      recoveredStaleCount: number;
    }> => {
      let isAuthorized = verifyWorkerCronAuthorization();

      // Fallback to Workspace Admin/Owner authentication
      if (!isAuthorized) {
        try {
          const auth = await requireWorkspaceAccess({
            workspaceId: data?.workspaceId,
            requiredRole: "admin",
          });
          if (auth.memberRole === "admin" || auth.memberRole === "owner") {
            isAuthorized = true;
          }
        } catch (authErr) {
          isAuthorized = false;
        }
      }

      if (!isAuthorized) {
        throw new Error(
          "UNAUTHORIZED_WORKER_TRIGGER: Worker execution requires a valid 'Authorization: Bearer <CRON_SECRET>' header or Workspace Admin/Owner authentication."
        );
      }

      if (!db) {
        throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
      }

      const batchSize = Math.min(Math.max(1, data?.batchSize || 10), 100);
      return await processOutboxBatchFn(batchSize, db);
    }
  );

export const triggerWebhookDeliveryWorkerInputSchema = z.object({
  workspaceId: z.string().optional(),
  batchSize: z.number().min(1, "Batch size must be at least 1").max(100, "Batch size cannot exceed 100").default(10),
});

/**
 * Server Function 15: triggerWebhookDeliveryWorkerFn
 * Triggers batch dispatch of pending webhook deliveries.
 * Authorization: Valid bearer `CRON_SECRET` header OR authenticated workspace Admin/Owner.
 */
export const triggerWebhookDeliveryWorkerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => triggerWebhookDeliveryWorkerInputSchema.parse(data || {}))
  .handler(
    async ({
      data,
    }): Promise<{
      claimedCount: number;
      deliveredCount: number;
      failedCount: number;
      retriedCount: number;
      recoveredStaleCount: number;
    }> => {
      let isAuthorized = verifyWorkerCronAuthorization();

      // Fallback to Workspace Admin/Owner authentication
      if (!isAuthorized) {
        try {
          const auth = await requireWorkspaceAccess({
            workspaceId: data?.workspaceId,
            requiredRole: "admin",
          });
          if (auth.memberRole === "admin" || auth.memberRole === "owner") {
            isAuthorized = true;
          }
        } catch (authErr) {
          isAuthorized = false;
        }
      }

      if (!isAuthorized) {
        throw new Error(
          "UNAUTHORIZED_WORKER_TRIGGER: Worker execution requires a valid 'Authorization: Bearer <CRON_SECRET>' header or Workspace Admin/Owner authentication."
        );
      }

      if (!db) {
        throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
      }

      const batchSize = Math.min(Math.max(1, data?.batchSize || 10), 100);
      return await processWebhookDeliveryBatchFn(batchSize, db);
    }
  );
