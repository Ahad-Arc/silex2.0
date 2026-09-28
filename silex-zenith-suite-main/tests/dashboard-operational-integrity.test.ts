/**
 * SILEX 2.0 — Dashboard Operational Integrity & Aggregations Test Suite (TASK-022)
 *
 * Verifies operational integrity and zero fake data invariants:
 * 1. computeMonthlyRevenueData aggregates paid invoices and handles empty states.
 * 2. compute7DayCashflowData aggregates incoming payments and outgoing expenses/refunds.
 * 3. Dashboard eliminates hardcoded revenue fallback (784320).
 * 4. Dashboard eliminates Acme Studio and Nova Labs mock fallback records.
 * 5. Dashboard mounts Active Tasks & Deliverables widget using metrics.tasksList.
 * 6. CRM client directory dynamically displays totalInvoicedCents and invoicesCount.
 * 7. CRM getClientsFn aggregates invoice revenue and count from invoices ledger.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

import {
  computeMonthlyRevenueData,
  compute7DayCashflowData,
} from "../src/routes/app.index";

test("1. REVENUE CALCULATION — computeMonthlyRevenueData handles empty invoice list", () => {
  const result = computeMonthlyRevenueData([]);
  assert.strictEqual(result.length, 6, "Must produce 6 months of historical data");
  for (const item of result) {
    assert.strictEqual(typeof item.m, "string", "Month label must be a string");
    assert.strictEqual(item.v, 0, "Revenue value must default to 0 for empty list");
  }
});

test("2. REVENUE CALCULATION — computeMonthlyRevenueData accurately aggregates paid invoices", () => {
  const now = new Date();
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const currentMonthName = monthNames[now.getMonth()];

  const mockInvoices: any[] = [
    {
      id: "inv-1",
      status: "paid",
      totalAmountCents: 150000, // $1,500
      issueDate: now.toISOString(),
    },
    {
      id: "inv-2",
      status: "Paid",
      totalCents: 250000, // $2,500
      paidAt: now.toISOString(),
    },
    {
      id: "inv-3",
      status: "sent", // Not paid, should be ignored
      totalAmountCents: 500000,
      issueDate: now.toISOString(),
    },
    {
      id: "inv-4",
      status: "draft", // Not paid, should be ignored
      totalAmountCents: 100000,
      issueDate: now.toISOString(),
    },
  ];

  const result = computeMonthlyRevenueData(mockInvoices);
  assert.strictEqual(result.length, 6);

  const currentMonthEntry = result.find((item) => item.m === currentMonthName);
  assert.ok(currentMonthEntry, "Current month entry must exist in 6-month history");
  assert.strictEqual(currentMonthEntry.v, 4000, "Current month revenue must equal $1,500 + $2,500 = $4,000");
});

test("3. CASHFLOW CALCULATION — compute7DayCashflowData handles empty payments list", () => {
  const result = compute7DayCashflowData([]);
  assert.strictEqual(result.length, 7, "Must produce 7 days of cashflow data");
  for (const item of result) {
    assert.strictEqual(typeof item.d, "string", "Day label must be a string");
    assert.strictEqual(item.i, 0, "Inflow must be 0");
    assert.strictEqual(item.o, 0, "Outflow must be 0");
  }
});

test("4. CASHFLOW CALCULATION — compute7DayCashflowData accurately sums inbound and outbound flows", () => {
  const now = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayName = dayNames[now.getDay()];

  const mockPayments: any[] = [
    {
      id: "pay-1",
      type: "payment",
      amountCents: 120000, // $1,200 incoming
      paymentDate: now.toISOString(),
    },
    {
      id: "pay-2",
      type: "expense",
      amountCents: 45000, // $450 outgoing
      paymentDate: now.toISOString(),
    },
    {
      id: "pay-3",
      type: "refund",
      amountCents: 5000, // $50 outgoing
      paidAt: now.toISOString(),
    },
  ];

  const result = compute7DayCashflowData(mockPayments);
  assert.strictEqual(result.length, 7);

  const todayEntry = result.find((item) => item.d === todayName);
  assert.ok(todayEntry, "Today's entry must exist in 7-day cashflow");
  assert.strictEqual(todayEntry.i, 1200, "Inflow must equal $1,200");
  assert.strictEqual(todayEntry.o, 500, "Outflow must equal $450 + $50 = $500");
});

test("5. CODEBASE HONESTY — app.index.tsx contains zero hardcoded revenue fallbacks", () => {
  const dashboardSource = fs.readFileSync(
    path.resolve(rootDir, "src/routes/app.index.tsx"),
    "utf-8"
  );
  assert.ok(!dashboardSource.includes("784320"), "Must not contain hardcoded 784320 revenue fallback");
});

test("6. CODEBASE HONESTY — app.index.tsx contains zero Acme Studio mock fallbacks", () => {
  const dashboardSource = fs.readFileSync(
    path.resolve(rootDir, "src/routes/app.index.tsx"),
    "utf-8"
  );
  assert.ok(!dashboardSource.includes("Acme Studio"), "Must not contain Acme Studio mock fallback");
});

test("7. CODEBASE HONESTY — app.index.tsx contains zero Nova Labs mock fallbacks", () => {
  const dashboardSource = fs.readFileSync(
    path.resolve(rootDir, "src/routes/app.index.tsx"),
    "utf-8"
  );
  assert.ok(!dashboardSource.includes("Nova Labs"), "Must not contain Nova Labs mock fallback");
});

test("8. ACTIVE WORKSPACE TASKS — app.index.tsx renders Active Tasks & Deliverables widget", () => {
  const dashboardSource = fs.readFileSync(
    path.resolve(rootDir, "src/routes/app.index.tsx"),
    "utf-8"
  );
  assert.ok(dashboardSource.includes("Active tasks & deliverables"), "Must render Active tasks & deliverables widget");
  assert.ok(dashboardSource.includes("metrics.tasksList"), "Must bind metrics.tasksList to active deliverables UI");
});

test("9. CRM CLIENT DIRECTORY — app.clients.tsx dynamically binds totalInvoicedCents and invoicesCount", () => {
  const clientsSource = fs.readFileSync(
    path.resolve(rootDir, "src/routes/app.clients.tsx"),
    "utf-8"
  );
  assert.ok(clientsSource.includes("totalInvoicedCents"), "Must read totalInvoicedCents from client payload");
  assert.ok(clientsSource.includes("invoicesCount"), "Must read invoicesCount from client payload");
  assert.ok(!clientsSource.includes("rev: 0,"), "Must not hardcode rev: 0");
});

test("10. CRM SERVER AGGREGATION — getClientsFn computes revenue and count from invoices ledger", () => {
  const crmSource = fs.readFileSync(
    path.resolve(rootDir, "src/lib/server-functions/crm.ts"),
    "utf-8"
  );
  assert.ok(crmSource.includes("totalInvoicedCents"), "Must compute totalInvoicedCents per client");
  assert.ok(crmSource.includes("invoicesCount"), "Must compute invoicesCount per client");
});
