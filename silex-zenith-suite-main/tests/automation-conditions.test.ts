/**
 * SILEX Automation Engine — Condition Engine Security & Determinism Test Suite
 */

import assert from "node:assert";
import test from "node:test";
import {
  evaluateCondition,
  evaluateConditions,
  resolveFieldPath,
  type AutomationCondition,
} from "../src/lib/automation/conditions";

test("1. OPERATOR `eq` & `neq` — Equality Semantics", () => {
  const context = {
    event: {
      eventType: "invoice.paid",
      payload: {
        totalCents: 15000,
        status: "paid",
        issueDate: "2026-09-01T00:00:00.000Z",
      },
    },
  };

  // eq success
  assert.strictEqual(
    evaluateCondition(
      { field: "event.eventType", operator: "eq", value: "invoice.paid" },
      context
    ),
    true
  );

  // eq failure
  assert.strictEqual(
    evaluateCondition(
      { field: "event.eventType", operator: "eq", value: "invoice.created" },
      context
    ),
    false
  );

  // neq success
  assert.strictEqual(
    evaluateCondition(
      { field: "event.eventType", operator: "neq", value: "invoice.created" },
      context
    ),
    true
  );
});

test("2. NUMERIC COMPARISONS — `gt`, `gte`, `lt`, `lte`", () => {
  const context = {
    invoice: {
      totalCents: 50000,
    },
  };

  assert.strictEqual(
    evaluateCondition(
      { field: "invoice.totalCents", operator: "gt", value: 10000 },
      context
    ),
    true
  );

  assert.strictEqual(
    evaluateCondition(
      { field: "invoice.totalCents", operator: "gt", value: 50000 },
      context
    ),
    false
  );

  assert.strictEqual(
    evaluateCondition(
      { field: "invoice.totalCents", operator: "gte", value: 50000 },
      context
    ),
    true
  );

  assert.strictEqual(
    evaluateCondition(
      { field: "invoice.totalCents", operator: "lt", value: 100000 },
      context
    ),
    true
  );

  assert.strictEqual(
    evaluateCondition(
      { field: "invoice.totalCents", operator: "lte", value: 50000 },
      context
    ),
    true
  );
});

test("3. ISO DATE COMPARISONS — Timestamp Resolution", () => {
  const context = {
    task: {
      dueDate: "2026-09-15T12:00:00.000Z",
    },
  };

  assert.strictEqual(
    evaluateCondition(
      { field: "task.dueDate", operator: "gt", value: "2026-09-01T00:00:00.000Z" },
      context
    ),
    true
  );

  assert.strictEqual(
    evaluateCondition(
      { field: "task.dueDate", operator: "lt", value: "2026-10-01T00:00:00.000Z" },
      context
    ),
    true
  );
});

test("4. STRING & ARRAY `contains` OPERATOR", () => {
  const context = {
    client: {
      companyName: "Acme Zenith Corporation",
      tags: ["vip", "enterprise", "agency"],
    },
  };

  // Substring containment
  assert.strictEqual(
    evaluateCondition(
      { field: "client.companyName", operator: "contains", value: "Zenith" },
      context
    ),
    true
  );

  assert.strictEqual(
    evaluateCondition(
      { field: "client.companyName", operator: "contains", value: "Stripe" },
      context
    ),
    false
  );

  // Array element containment
  assert.strictEqual(
    evaluateCondition(
      { field: "client.tags", operator: "contains", value: "enterprise" },
      context
    ),
    true
  );

  assert.strictEqual(
    evaluateCondition(
      { field: "client.tags", operator: "contains", value: "startup" },
      context
    ),
    false
  );
});

test("5. ARRAY `in` OPERATOR — Target Set Inclusion", () => {
  const context = {
    project: {
      status: "in_progress",
    },
  };

  assert.strictEqual(
    evaluateCondition(
      { field: "project.status", operator: "in", value: ["planning", "in_progress", "active"] },
      context
    ),
    true
  );

  assert.strictEqual(
    evaluateCondition(
      { field: "project.status", operator: "in", value: ["completed", "closed"] },
      context
    ),
    false
  );

  // Rejects non-array `right` parameter
  assert.strictEqual(
    evaluateCondition(
      { field: "project.status", operator: "in", value: "in_progress" },
      context
    ),
    false
  );
});

test("6. PROTOTYPE POLLUTION DEFENSE — Dangerous Property Traversal", () => {
  const context = {
    normalKey: "value",
  };

  // Block __proto__
  assert.strictEqual(resolveFieldPath(context, "__proto__.polluted"), undefined);
  assert.strictEqual(
    evaluateCondition(
      { field: "__proto__.polluted", operator: "eq", value: true },
      context
    ),
    false
  );

  // Block constructor
  assert.strictEqual(resolveFieldPath(context, "constructor.name"), undefined);
  assert.strictEqual(
    evaluateCondition(
      { field: "constructor.name", operator: "eq", value: "Object" },
      context
    ),
    false
  );

  // Block prototype
  assert.strictEqual(resolveFieldPath(context, "prototype.toString"), undefined);
});

test("7. BOUNDED PATH & INPUT LIMITS", () => {
  const context = {
    a: { b: { c: { d: { e: { f: "too_deep" } } } } },
  };

  // Max depth is 5 segments (a.b.c.d.e.f has 6 segments -> returns undefined)
  assert.strictEqual(resolveFieldPath(context, "a.b.c.d.e.f"), undefined);

  // Oversized path string (> 100 chars)
  const longPath = "a.".repeat(60);
  assert.strictEqual(resolveFieldPath(context, longPath), undefined);

  // Bounded condition list limit (> 20 conditions returns false)
  const oversizedConditions: AutomationCondition[] = Array.from({ length: 25 }, () => ({
    field: "a.b.c",
    operator: "eq",
    value: "test",
  }));

  assert.strictEqual(evaluateConditions(oversizedConditions, context), false);
});

test("8. INVALID OPERATORS & MALFORMED CONDITIONS", () => {
  const context = { status: "active" };

  // Unknown operator
  assert.strictEqual(
    evaluateCondition(
      { field: "status", operator: "regex" as any, value: ".*" },
      context
    ),
    false
  );

  // Missing field
  assert.strictEqual(
    evaluateCondition(
      { field: "", operator: "eq", value: "active" },
      context
    ),
    false
  );
});

test("9. MULTI-CONDITION EVALUATION — `all` AND `any` MATCH MODES", () => {
  const context = {
    task: {
      priority: "high",
      status: "todo",
      estimatedHours: 10,
    },
  };

  const conditions: AutomationCondition[] = [
    { field: "task.priority", operator: "eq", value: "high" },
    { field: "task.estimatedHours", operator: "gte", value: 5 },
  ];

  assert.strictEqual(evaluateConditions(conditions, context, "all"), true);

  const mixedConditions: AutomationCondition[] = [
    { field: "task.priority", operator: "eq", value: "low" },
    { field: "task.status", operator: "eq", value: "todo" },
  ];

  assert.strictEqual(evaluateConditions(mixedConditions, context, "all"), false);
  assert.strictEqual(evaluateConditions(mixedConditions, context, "any"), true);
});
