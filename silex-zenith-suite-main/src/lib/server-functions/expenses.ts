/**
 * SILEX 2.0 — Finance Expenses Server Functions
 *
 * Implements workspace-isolated CRUD and calculations for:
 * 1. getExpensesFn — retrieve active expenses, category breakdown, project allocations
 * 2. createExpenseFn — record business expense with integer cents, optional project link, metadata receipt
 * 3. deleteExpenseFn — soft-delete expense (deletedAt) preserving relational audit trail
 *
 * $0 Storage Invariant: Receipt URLs are strictly stored as metadata text/links
 * with zero physical storage buckets or paid cloud dependencies.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, isNull, desc, gte, lte } from "drizzle-orm";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { db } from "@/db";
import { expenses, projects, users } from "@/db/schema";

// ============================================================================
// Input Validation Schemas
// ============================================================================

export const getExpensesInputSchema = z
  .object({
    workspaceId: z.string().optional(),
    category: z.string().optional(),
    projectId: z.string().optional(),
    search: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .optional();

export const createExpenseInputSchema = z.object({
  workspaceId: z.string().optional(),
  amountCents: z.number().int().positive("Expense amount must be greater than zero"),
  category: z.string().trim().min(1, "Category is required").max(100),
  vendorName: z.string().trim().max(255).optional(),
  expenseDate: z.string().optional(),
  currency: z.string().trim().length(3).default("USD"),
  projectId: z.string().uuid("Invalid project ID").optional().nullable(),
  receiptUrl: z.string().trim().max(2048).optional().nullable(),
});

export const deleteExpenseInputSchema = z.object({
  workspaceId: z.string().optional(),
  expenseId: z.string().min(1, "Expense ID is required"),
});

export type GetExpensesInput = z.infer<typeof getExpensesInputSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;
export type DeleteExpenseInput = z.infer<typeof deleteExpenseInputSchema>;

// Canonical expense categories for consistent UI & reporting
export const EXPENSE_CATEGORIES = [
  "Software & SaaS",
  "Hosting & Cloud",
  "Office & Workspace",
  "Travel & Dining",
  "Equipment & Hardware",
  "Marketing & Ads",
  "Legal & Professional",
  "Contractors",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Server Function: getExpensesFn
 * Retrieves all active expenses for the authorized workspace with category breakdown and project details.
 */
export const getExpensesFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getExpensesInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // Base query: workspace scoped and not soft-deleted
    const conditions = [
      eq(expenses.workspaceId, auth.workspaceId),
      isNull(expenses.deletedAt),
    ];

    if (data?.category && data.category !== "All") {
      conditions.push(eq(expenses.category, data.category));
    }

    if (data?.projectId) {
      conditions.push(eq(expenses.projectId, data.projectId));
    }

    if (data?.startDate) {
      conditions.push(gte(expenses.expenseDate, new Date(data.startDate)));
    }

    if (data?.endDate) {
      conditions.push(lte(expenses.expenseDate, new Date(data.endDate)));
    }

    const rows = await db
      .select({
        expense: expenses,
        project: {
          id: projects.id,
          name: projects.name,
          code: projects.code,
        },
        creator: {
          id: users.id,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(expenses)
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .leftJoin(users, eq(expenses.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate));

    // Calculate aggregated metrics
    let totalExpensesCents = 0;
    let projectLinkedCents = 0;
    const categoryTotals: Record<string, number> = {};

    const formattedExpenses = rows.map(({ expense, project, creator }) => {
      totalExpensesCents += expense.amountCents;

      if (expense.projectId) {
        projectLinkedCents += expense.amountCents;
      }

      const cat = expense.category || "Other";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + expense.amountCents;

      return {
        id: expense.id,
        workspaceId: expense.workspaceId,
        category: expense.category,
        amountCents: expense.amountCents,
        currency: expense.currency,
        expenseDate: expense.expenseDate.toISOString(),
        vendorName: expense.vendorName,
        projectId: expense.projectId,
        projectName: project?.name ?? null,
        projectCode: project?.code ?? null,
        receiptUrl: expense.receiptUrl,
        createdBy: expense.createdBy,
        creatorName: creator?.fullName ?? "Workspace Teammate",
        creatorAvatarUrl: creator?.avatarUrl ?? null,
        createdAt: expense.createdAt.toISOString(),
      };
    });

    return {
      expenses: formattedExpenses,
      stats: {
        totalExpensesCents,
        projectLinkedCents,
        count: formattedExpenses.length,
        categoryBreakdown: categoryTotals,
      },
    };
  });

/**
 * Server Function: createExpenseFn
 * Records an authorized workspace expense with integer cents and optional project linking.
 */
export const createExpenseFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createExpenseInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // If projectId is provided, verify it belongs to this workspace
    if (data.projectId) {
      const projectRows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, data.projectId),
            eq(projects.workspaceId, auth.workspaceId),
            isNull(projects.deletedAt)
          )
        )
        .limit(1);

      if (projectRows.length === 0) {
        throw new Error("PROJECT_NOT_FOUND: The linked project does not exist in this workspace.");
      }
    }

    const expenseDate = data.expenseDate ? new Date(data.expenseDate) : new Date();

    const [inserted] = await db
      .insert(expenses)
      .values({
        workspaceId: auth.workspaceId,
        category: data.category,
        amountCents: data.amountCents,
        currency: data.currency.toUpperCase(),
        expenseDate,
        vendorName: data.vendorName || null,
        projectId: data.projectId || null,
        receiptUrl: data.receiptUrl || null,
        createdBy: auth.userId,
      })
      .returning();

    return {
      id: inserted.id,
      workspaceId: inserted.workspaceId,
      category: inserted.category,
      amountCents: inserted.amountCents,
      currency: inserted.currency,
      expenseDate: inserted.expenseDate.toISOString(),
      vendorName: inserted.vendorName,
      projectId: inserted.projectId,
      receiptUrl: inserted.receiptUrl,
      createdAt: inserted.createdAt.toISOString(),
    };
  });

/**
 * Server Function: deleteExpenseFn
 * Soft-deletes an expense record in the authorized workspace.
 */
export const deleteExpenseFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteExpenseInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // Verify expense belongs to authorized workspace
    const existing = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(
        and(
          eq(expenses.id, data.expenseId),
          eq(expenses.workspaceId, auth.workspaceId),
          isNull(expenses.deletedAt)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      throw new Error("EXPENSE_NOT_FOUND: Expense not found or already deleted.");
    }

    // Soft delete
    await db
      .update(expenses)
      .set({ deletedAt: new Date() })
      .where(and(eq(expenses.id, data.expenseId), eq(expenses.workspaceId, auth.workspaceId)));

    return {
      success: true,
      id: data.expenseId,
    };
  });
