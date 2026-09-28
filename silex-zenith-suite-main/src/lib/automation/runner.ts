/**
 * SILEX Automation Workflow Engine — Workflow Execution Engine
 * 
 * Executes matched workflow rules for outbox events under strict workspace isolation
 * and server-authoritative trusted execution context.
 */

import { eq, and, asc } from "drizzle-orm";
import { db as globalDb } from "@/db";
import {
  automationRules,
  automationRuns,
  idempotencyKeys,
  outboxEvents,
} from "@/db/schema";
import { evaluateConditions } from "./conditions";
import {
  executeAutomationAction,
  type TrustedExecutionContext,
  type AutomationActionParams,
} from "./actions";
import type { OutboxEventRecord } from "@/lib/events/types";


/**
 * Result contract for workflow execution per outbox event
 */
export interface WorkflowExecutionOutcome {
  status: "processed" | "pending" | "failed";
  outboxEventId: string;
  matchedRulesCount: number;
  executedRunsCount: number;
  skippedRulesCount: number;
  failedRulesCount: number;
  error?: string;
}

/**
 * Atomically reserves a rule execution key using INSERT ON CONFLICT DO NOTHING
 */
async function reserveRuleExecutionKey(
  executor: any,
  workspaceId: string,
  key: string
): Promise<boolean> {
  const client = executor || globalDb;
  if (!client) return false;

  try {
    const inserted = await client
      .insert(idempotencyKeys)
      .values({
        workspaceId,
        key,
        requestPath: "automation_run",
        status: "completed",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiration
      })
      .onConflictDoNothing({
        target: [idempotencyKeys.workspaceId, idempotencyKeys.key],
      })
      .returning({ id: idempotencyKeys.id });

    return Array.isArray(inserted) && inserted.length > 0;
  } catch (err) {
    // If insertion failed due to unique constraint or DB error, treat as unreserved/conflict
    return false;
  }
}

/**
 * Executes all matching automation rules for a claimed outbox event.
 * 
 * Enforces workspace isolation, rule-level idempotency, trusted context,
 * and isolated per-rule transactions.
 */
export async function executeWorkflowForOutboxEvent(
  outboxEvent: OutboxEventRecord,
  executor?: any
): Promise<WorkflowExecutionOutcome> {
  const client = executor || globalDb;
  if (!client) {
    throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
  }

  // 1. Construct TrustedExecutionContext
  // CRITICAL SECURITY RULE: actorUserId MUST come strictly from outboxEvent.actorId (never from payload!)
  const trustedContext: TrustedExecutionContext = {
    workspaceId: outboxEvent.workspaceId,
    actorUserId: outboxEvent.actorId ?? null,
    event: {
      id: outboxEvent.id,
      eventType: outboxEvent.eventType,
      aggregateType: outboxEvent.aggregateType,
      aggregateId: outboxEvent.aggregateId,
      payload: outboxEvent.payload,
      createdAt: outboxEvent.createdAt,
    },
    correlationId: outboxEvent.id,
  };

  // 2. Fetch enabled matching automation rules for workspace and trigger event
  const matchedRules = await client
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.workspaceId, outboxEvent.workspaceId), // Enforce workspace boundary
        eq(automationRules.triggerEvent, outboxEvent.eventType),
        eq(automationRules.isEnabled, true)
      )
    )
    .orderBy(asc(automationRules.createdAt), asc(automationRules.id));

  // If no rules match this event topic, mark outbox event processed immediately
  if (matchedRules.length === 0) {
    await client
      .update(outboxEvents)
      .set({
        status: "processed",
        processedAt: new Date(),
        errorMessage: null,
      })
      .where(
        and(
          eq(outboxEvents.id, outboxEvent.id),
          eq(outboxEvents.workspaceId, outboxEvent.workspaceId)
        )
      );

    return {
      status: "processed",
      outboxEventId: outboxEvent.id,
      matchedRulesCount: 0,
      executedRunsCount: 0,
      skippedRulesCount: 0,
      failedRulesCount: 0,
    };
  }

  let executedRunsCount = 0;
  let skippedRulesCount = 0;
  let failedRulesCount = 0;

  // 3. Process each rule with isolated per-rule transaction
  for (const rule of matchedRules) {
    const idempotencyKey = `auto_run:${rule.id}:${outboxEvent.id}`;

    // Execute per-rule step inside an isolated transaction
    try {
      const executeRuleStep = async (tx: any) => {
        // Step A: Reserve idempotency key atomically
        const reserved = await reserveRuleExecutionKey(
          tx,
          outboxEvent.workspaceId,
          idempotencyKey
        );

        if (!reserved) {
          // Rule already executed or currently claimed. Skip!
          skippedRulesCount++;
          return;
        }

        // Step B: Evaluate condition engine
        const conditionsList = (rule.conditions as any[]) || [];
        const conditionContext = {
          ...outboxEvent.payload,
          event: {
            type: outboxEvent.eventType,
            aggregateType: outboxEvent.aggregateType,
            aggregateId: outboxEvent.aggregateId,
            payload: outboxEvent.payload,
          },
        };

        const isConditionMet =
          conditionsList.length === 0 ||
          evaluateConditions(conditionsList, conditionContext, "all");

        if (!isConditionMet) {
          // Conditions false -> Create automation_runs record with status 'skipped'
          await tx.insert(automationRuns).values({
            workspaceId: outboxEvent.workspaceId,
            ruleId: rule.id,
            outboxEventId: outboxEvent.id,
            status: "skipped",
            logs: [
              {
                timestamp: new Date().toISOString(),
                outboxEventId: outboxEvent.id,
                ruleId: rule.id,
                eventType: outboxEvent.eventType,
                conditionMatched: false,
                message: "Rule conditions evaluated to false. Execution skipped.",
              },
            ],
            executedAt: new Date(),
          });

          skippedRulesCount++;
          return;
        }

        // Step C: Conditions true -> Execute allowlisted actions using Action Registry
        const actionList = (rule.actions as AutomationActionParams[]) || [];
        const actionLogs: Array<Record<string, unknown>> = [];
        let ruleFailed = false;
        let errorMessage = "";

        for (const actionParams of actionList) {
          try {
            const actionResult = await executeAutomationAction(
              actionParams,
              trustedContext,
              tx
            );
            actionLogs.push({
              actionType: actionParams.type,
              success: actionResult.success,
              result: actionResult.result,
            });
          } catch (actionErr: any) {
            ruleFailed = true;
            errorMessage =
              actionErr?.message || "Action execution encountered an error.";
            actionLogs.push({
              actionType: actionParams?.type || "unknown",
              success: false,
              error: errorMessage.substring(0, 500),
            });
            break; // Terminate action sequence for this rule
          }
        }

        const runStatus = ruleFailed ? "failed" : "completed";
        if (ruleFailed) {
          failedRulesCount++;
        } else {
          executedRunsCount++;
        }

        // Step D: Write automation_runs record
        await tx.insert(automationRuns).values({
          workspaceId: outboxEvent.workspaceId,
          ruleId: rule.id,
          outboxEventId: outboxEvent.id,
          status: runStatus,
          logs: [
            {
              timestamp: new Date().toISOString(),
              outboxEventId: outboxEvent.id,
              ruleId: rule.id,
              eventType: outboxEvent.eventType,
              conditionMatched: true,
              actions: actionLogs,
              error: ruleFailed ? errorMessage.substring(0, 500) : undefined,
            },
          ],
          executedAt: new Date(),
        });
      };

      // Execute inside transaction if transaction helper is available, otherwise use client directly
      if (typeof client.transaction === "function") {
        await client.transaction(executeRuleStep);
      } else {
        await executeRuleStep(client);
      }
    } catch (ruleTxError: any) {
      failedRulesCount++;
    }
  }

  // 4. Mark outbox event as 'processed' after evaluating all matching rules
  await client
    .update(outboxEvents)
    .set({
      status: "processed",
      processedAt: new Date(),
      errorMessage: null,
    })
    .where(
      and(
        eq(outboxEvents.id, outboxEvent.id),
        eq(outboxEvents.workspaceId, outboxEvent.workspaceId)
      )
    );

  return {
    status: "processed",
    outboxEventId: outboxEvent.id,
    matchedRulesCount: matchedRules.length,
    executedRunsCount,
    skippedRulesCount,
    failedRulesCount,
  };
}
