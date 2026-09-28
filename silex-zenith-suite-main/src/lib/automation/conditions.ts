/**
 * SILEX Automation Workflow Engine — Condition Engine
 * 
 * Bounded, deterministic, server-only condition evaluation module.
 * Evaluates trigger conditions against untrusted context payloads.
 */

import { z } from "zod";


/**
 * Allowlisted Condition Operators
 */
export const CONDITION_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "in",
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const conditionOperatorSchema = z.enum(CONDITION_OPERATORS);

/**
 * Automation Condition Schema
 */
export const automationConditionSchema = z.object({
  field: z.string().min(1, "Field path is required").max(100, "Field path exceeds max length"),
  operator: conditionOperatorSchema,
  value: z.unknown(),
});

export type AutomationCondition = z.infer<typeof automationConditionSchema>;

/**
 * Dangerous property keys to block prototype pollution attacks
 */
const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"];

/**
 * Safely resolves nested property paths (e.g. "event.payload.amountCents")
 * against an object context while guarding against prototype pollution.
 */
export function resolveFieldPath(target: unknown, path: string): unknown {
  if (!path || typeof path !== "string" || path.length > 100) {
    return undefined;
  }
  if (target === null || target === undefined || typeof target !== "object") {
    return undefined;
  }

  const segments = path.split(".");
  if (segments.length > 5) {
    return undefined; // Max nested depth boundary
  }

  let current: any = target;
  for (const segment of segments) {
    if (!segment || DANGEROUS_KEYS.includes(segment.toLowerCase())) {
      return undefined; // Block prototype traversal
    }
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

/**
 * Safely attempts to parse a value into a timestamp number if valid date string or Date instance.
 */
function tryParseDateTimestamp(val: unknown): number | null {
  if (val instanceof Date) {
    const time = val.getTime();
    return isNaN(time) ? null : time;
  }

  if (typeof val === "string" && val.length >= 10 && val.length <= 35) {
    // Basic ISO 8601 date string check
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      const time = Date.parse(val);
      return isNaN(time) ? null : time;
    }
  }

  return null;
}

/**
 * Evaluates `eq` (equality)
 */
function evaluateEq(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  // Date comparison fallback
  const leftDate = tryParseDateTimestamp(left);
  const rightDate = tryParseDateTimestamp(right);
  if (leftDate !== null && rightDate !== null) {
    return leftDate === rightDate;
  }

  return false;
}

/**
 * Evaluates `neq` (inequality)
 */
function evaluateNeq(left: unknown, right: unknown): boolean {
  return !evaluateEq(left, right);
}

/**
 * Evaluates `gt` (greater than)
 */
function evaluateGt(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return left > right;
  }

  const leftDate = tryParseDateTimestamp(left);
  const rightDate = tryParseDateTimestamp(right);
  if (leftDate !== null && rightDate !== null) {
    return leftDate > rightDate;
  }

  return false;
}

/**
 * Evaluates `gte` (greater than or equal)
 */
function evaluateGte(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return left >= right;
  }

  const leftDate = tryParseDateTimestamp(left);
  const rightDate = tryParseDateTimestamp(right);
  if (leftDate !== null && rightDate !== null) {
    return leftDate >= rightDate;
  }

  return evaluateEq(left, right);
}

/**
 * Evaluates `lt` (less than)
 */
function evaluateLt(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return left < right;
  }

  const leftDate = tryParseDateTimestamp(left);
  const rightDate = tryParseDateTimestamp(right);
  if (leftDate !== null && rightDate !== null) {
    return leftDate < rightDate;
  }

  return false;
}

/**
 * Evaluates `lte` (less than or equal)
 */
function evaluateLte(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return left <= right;
  }

  const leftDate = tryParseDateTimestamp(left);
  const rightDate = tryParseDateTimestamp(right);
  if (leftDate !== null && rightDate !== null) {
    return leftDate <= rightDate;
  }

  return evaluateEq(left, right);
}

/**
 * Evaluates `contains` (substring or array inclusion)
 */
function evaluateContains(left: unknown, right: unknown): boolean {
  if (typeof left === "string" && typeof right === "string") {
    if (left.length > 1000 || right.length > 1000) {
      return false; // Bounded comparison length
    }
    return left.includes(right);
  }

  if (Array.isArray(left)) {
    if (left.length > 500) {
      return false; // Bounded array search size
    }
    return left.some((item) => evaluateEq(item, right));
  }

  return false;
}

/**
 * Evaluates `in` (value match within a target array)
 */
function evaluateIn(left: unknown, right: unknown): boolean {
  if (!Array.isArray(right) || right.length > 100) {
    return false; // Bounded target set size
  }

  return right.some((allowedValue) => evaluateEq(left, allowedValue));
}

/**
 * Evaluates a single AutomationCondition against a context object.
 */
export function evaluateCondition(
  condition: AutomationCondition,
  context: Record<string, unknown>
): boolean {
  const parsed = automationConditionSchema.safeParse(condition);
  if (!parsed.success) {
    return false;
  }

  const fieldValue = resolveFieldPath(context, parsed.data.field);

  switch (parsed.data.operator) {
    case "eq":
      return evaluateEq(fieldValue, parsed.data.value);
    case "neq":
      return evaluateNeq(fieldValue, parsed.data.value);
    case "gt":
      return evaluateGt(fieldValue, parsed.data.value);
    case "gte":
      return evaluateGte(fieldValue, parsed.data.value);
    case "lt":
      return evaluateLt(fieldValue, parsed.data.value);
    case "lte":
      return evaluateLte(fieldValue, parsed.data.value);
    case "contains":
      return evaluateContains(fieldValue, parsed.data.value);
    case "in":
      return evaluateIn(fieldValue, parsed.data.value);
    default:
      return false;
  }
}

/**
 * Evaluates a list of conditions against a context object with a match mode.
 */
export function evaluateConditions(
  conditions: AutomationCondition[],
  context: Record<string, unknown>,
  matchMode: "all" | "any" = "all"
): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0 || conditions.length > 20) {
    return false; // Max 20 conditions per rule
  }

  if (matchMode === "any") {
    return conditions.some((cond) => evaluateCondition(cond, context));
  }

  return conditions.every((cond) => evaluateCondition(cond, context));
}
