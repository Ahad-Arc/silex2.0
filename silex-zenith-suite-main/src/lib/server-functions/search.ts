import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, isNull, ilike, or, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { projects, tasks } from "@/db/schema/projects";
import { documents } from "@/db/schema/documents";
import { clients } from "@/db/schema/crm";
import { invoices, expenses } from "@/db/schema/finance";

export const globalSearchInputSchema = z.object({
  query: z.string().optional().default(""),
  limit: z.number().int().min(1).max(100).optional().default(30),
  workspaceId: z.string().optional(),
});

export type GlobalSearchInput = z.infer<typeof globalSearchInputSchema>;

export interface SearchResultItem {
  id: string;
  entityType: "project" | "task" | "document" | "client" | "invoice" | "expense";
  title: string;
  subtitle: string | null;
  route: string;
  createdAt?: string | null;
  metadata?: Record<string, any>;
}

export interface GlobalSearchResponse {
  query: string;
  totalCount: number;
  results: SearchResultItem[];
  groupedResults: {
    projects: SearchResultItem[];
    tasks: SearchResultItem[];
    documents: SearchResultItem[];
    clients: SearchResultItem[];
    invoices: SearchResultItem[];
    expenses: SearchResultItem[];
  };
}

/**
 * Server Function: globalSearchFn
 * Performs workspace-isolated, server-authoritative full-text / pattern search
 * across Projects, Tasks, Documents, CRM Clients, Invoices, and Expenses.
 */
export const globalSearchFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => globalSearchInputSchema.parse(d ?? {}))
  .handler(async ({ data }): Promise<GlobalSearchResponse> => {
    if (typeof window !== "undefined") {
      throw new Error("SERVER_ONLY_FUNCTION: This server function cannot be called on the client.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database connection is uninitialized.");
    }

    const queryStr = (data.query || "").trim();
    if (!queryStr) {
      return {
        query: "",
        totalCount: 0,
        results: [],
        groupedResults: {
          projects: [],
          tasks: [],
          documents: [],
          clients: [],
          invoices: [],
          expenses: [],
        },
      };
    }

    const pattern = `%${queryStr}%`;
    const perCategoryLimit = Math.max(3, Math.min(10, Math.ceil(data.limit / 6)));

    // 1. Projects Search
    const projectRows = await db
      .select({
        id: projects.id,
        name: projects.name,
        code: projects.code,
        status: projects.status,
        description: projects.description,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, auth.workspaceId),
          isNull(projects.deletedAt),
          or(
            ilike(projects.name, pattern),
            ilike(projects.code, pattern),
            ilike(projects.description, pattern)
          )
        )
      )
      .orderBy(desc(projects.createdAt))
      .limit(perCategoryLimit);

    const projectResults: SearchResultItem[] = projectRows.map((p) => ({
      id: p.id,
      entityType: "project",
      title: p.name,
      subtitle: p.code ? `[${p.code}] · Status: ${p.status}` : `Status: ${p.status}`,
      route: `/app/projects/${p.id}`,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
    }));

    // 2. Tasks Search
    const taskRows = await db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, auth.workspaceId),
          isNull(tasks.deletedAt),
          or(ilike(tasks.title, pattern), ilike(tasks.description, pattern))
        )
      )
      .orderBy(desc(tasks.createdAt))
      .limit(perCategoryLimit);

    const taskResults: SearchResultItem[] = taskRows.map((t) => ({
      id: t.id,
      entityType: "task",
      title: t.title,
      subtitle: `Status: ${t.status} · Priority: ${t.priority}`,
      route: t.projectId ? `/app/projects/${t.projectId}` : `/app/projects`,
      createdAt: t.createdAt ? t.createdAt.toISOString() : null,
      metadata: { projectId: t.projectId },
    }));

    // 3. Documents Search
    const documentRows = await db
      .select({
        id: documents.id,
        title: documents.title,
        isTemplate: documents.isTemplate,
        createdAt: documents.createdAt,
        contentJson: documents.contentJson,
      })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, auth.workspaceId),
          isNull(documents.deletedAt),
          or(
            ilike(documents.title, pattern),
            sql`${documents.contentJson}::text ilike ${pattern}`
          )
        )
      )
      .orderBy(desc(documents.createdAt))
      .limit(perCategoryLimit);

    const documentResults: SearchResultItem[] = documentRows.map((d) => ({
      id: d.id,
      entityType: "document",
      title: d.title,
      subtitle: d.isTemplate ? "Document Template" : "Workspace Document",
      route: `/app/documents/${d.id}`,
      createdAt: d.createdAt ? d.createdAt.toISOString() : null,
    }));

    // 4. CRM Clients Search
    const clientRows = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        website: clients.website,
        status: clients.status,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(
        and(
          eq(clients.workspaceId, auth.workspaceId),
          isNull(clients.deletedAt),
          or(ilike(clients.companyName, pattern), ilike(clients.website, pattern))
        )
      )
      .orderBy(desc(clients.createdAt))
      .limit(perCategoryLimit);

    const clientResults: SearchResultItem[] = clientRows.map((c) => ({
      id: c.id,
      entityType: "client",
      title: c.companyName,
      subtitle: c.website ? `Status: ${c.status} · ${c.website}` : `Status: ${c.status}`,
      route: `/app/clients/${c.id}`,
      createdAt: c.createdAt ? c.createdAt.toISOString() : null,
    }));

    // 5. Invoices Search
    const invoiceRows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        totalCents: invoices.totalCents,
        currency: invoices.currency,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, auth.workspaceId),
          isNull(invoices.deletedAt),
          or(ilike(invoices.invoiceNumber, pattern), ilike(invoices.notes, pattern))
        )
      )
      .orderBy(desc(invoices.createdAt))
      .limit(perCategoryLimit);

    const invoiceResults: SearchResultItem[] = invoiceRows.map((inv) => ({
      id: inv.id,
      entityType: "invoice",
      title: `Invoice ${inv.invoiceNumber}`,
      subtitle: `${inv.status.toUpperCase()} · $${((inv.totalCents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${inv.currency}`,
      route: `/app/invoices/${inv.id}`,
      createdAt: inv.createdAt ? inv.createdAt.toISOString() : null,
    }));

    // 6. Expenses Search
    const expenseRows = await db
      .select({
        id: expenses.id,
        category: expenses.category,
        vendorName: expenses.vendorName,
        amountCents: expenses.amountCents,
        currency: expenses.currency,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.workspaceId, auth.workspaceId),
          isNull(expenses.deletedAt),
          or(
            ilike(expenses.category, pattern),
            ilike(expenses.vendorName, pattern)
          )
        )
      )
      .orderBy(desc(expenses.createdAt))
      .limit(perCategoryLimit);

    const expenseResults: SearchResultItem[] = expenseRows.map((e) => ({
      id: e.id,
      entityType: "expense",
      title: e.vendorName || e.category,
      subtitle: `Expense (${e.category}) · $${((e.amountCents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${e.currency}`,
      route: `/app/payments`,
      createdAt: e.createdAt ? e.createdAt.toISOString() : null,
    }));

    const allResults = [
      ...projectResults,
      ...taskResults,
      ...documentResults,
      ...clientResults,
      ...invoiceResults,
      ...expenseResults,
    ];

    return {
      query: queryStr,
      totalCount: allResults.length,
      results: allResults,
      groupedResults: {
        projects: projectResults,
        tasks: taskResults,
        documents: documentResults,
        clients: clientResults,
        invoices: invoiceResults,
        expenses: expenseResults,
      },
    };
  });
