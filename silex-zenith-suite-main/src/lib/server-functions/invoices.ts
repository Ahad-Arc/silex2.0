import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { db } from "@/db";
import { invoices, invoiceItems, payments, workspaceSettings, clients, clientContacts, expenses, projects } from "@/db/schema";
import { eq, and, isNull, desc, sql, gte, lte } from "drizzle-orm";

// Input Schemas
export const getInvoicesInputSchema = z.object({
  workspaceId: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});

export const getInvoiceByIdInputSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  workspaceId: z.string().optional(),
});

export const createInvoiceInputSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  projectId: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
  terms: z.string().optional(),
  taxCents: z.number().int().min(0).default(0),
  discountCents: z.number().int().min(0).default(0),
  items: z.array(
    z.object({
      description: z.string().min(1, "Description is required"),
      quantity: z.number().positive().default(1),
      unitPriceCents: z.number().int().min(0),
    })
  ).min(1, "At least one line item is required"),
  workspaceId: z.string().optional(),
});

export const getPaymentsInputSchema = z.object({
  workspaceId: z.string().optional(),
  search: z.string().optional(),
});

export const createPaymentInputSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  amountCents: z.number().int().positive("Payment amount must be greater than zero"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  transactionReference: z.string().optional(),
  paidAt: z.string().optional(),
  workspaceId: z.string().optional(),
});

export const updateInvoiceStatusInputSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
  workspaceId: z.string().optional(),
});

/**
 * Server Function: getInvoicesFn
 * Retrieves all invoices for the authorized workspace with client info and calculates summary KPIs.
 */
export const getInvoicesFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getInvoicesInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const rows = await db
      .select({
        invoice: invoices,
        client: {
          id: clients.id,
          companyName: clients.companyName,
        },
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(
        and(
          eq(invoices.workspaceId, auth.workspaceId),
          isNull(invoices.deletedAt)
        )
      )
      .orderBy(desc(invoices.createdAt));

    // Calculate Summary KPIs
    let outstandingCents = 0;
    let outstandingCount = 0;
    let overdueCents = 0;
    let overdueCount = 0;
    let paidMonthCents = 0;
    let paidMonthCount = 0;
    let totalPaidCents = 0;
    let totalPaidCount = 0;
    let draftCents = 0;
    let draftCount = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const formatInvoiceStatus = (status: string, isOverdue: boolean): string => {
      if (isOverdue) return "Overdue";
      switch (status.toLowerCase()) {
        case "partially_paid":
          return "Partially Paid";
        case "draft":
          return "Draft";
        case "sent":
          return "Sent";
        case "paid":
          return "Paid";
        case "overdue":
          return "Overdue";
        case "cancelled":
          return "Cancelled";
        default:
          return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
      }
    };

    const formattedInvoices = rows.map(({ invoice, client }) => {
      const remainingCents = invoice.totalCents - invoice.amountPaidCents;
      const isOverdue = invoice.status === "overdue" || (invoice.dueDate < now && remainingCents > 0 && invoice.status !== "paid");
      const currentStatus = formatInvoiceStatus(invoice.status, isOverdue);

      if (invoice.status === "draft") {
        draftCents += invoice.totalCents;
        draftCount++;
      } else if (invoice.status === "paid") {
        totalPaidCents += invoice.totalCents;
        totalPaidCount++;
        if (invoice.updatedAt >= startOfMonth) {
          paidMonthCents += invoice.totalCents;
          paidMonthCount++;
        }
      } else {
        outstandingCents += remainingCents;
        outstandingCount++;
        if (isOverdue) {
          overdueCents += remainingCents;
          overdueCount++;
        }
      }

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: client?.companyName || "Unknown Client",
        clientId: invoice.clientId,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        currency: invoice.currency,
        subtotalCents: invoice.subtotalCents,
        taxCents: invoice.taxCents,
        discountCents: invoice.discountCents,
        totalCents: invoice.totalCents,
        amountPaidCents: invoice.amountPaidCents,
        status: currentStatus,
        notes: invoice.notes,
        createdAt: invoice.createdAt.toISOString(),
      };
    });

    return {
      invoices: formattedInvoices,
      stats: {
        outstandingCents,
        outstandingCount,
        overdueCents,
        overdueCount,
        paidMonthCents,
        paidMonthCount,
        totalPaidCents,
        totalPaidCount,
        draftCents,
        draftCount,
      },
    };
  });

/**
 * Server Function: getInvoiceByIdFn
 * Retrieves invoice detail, associated line items, and client information for the authorized workspace.
 */
export const getInvoiceByIdFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getInvoiceByIdInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const invoiceRows = await db
      .select({
        invoice: invoices,
        client: clients,
        contact: clientContacts,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .leftJoin(
        clientContacts,
        and(
          eq(clientContacts.clientId, clients.id),
          eq(clientContacts.isPrimary, true),
          isNull(clientContacts.deletedAt)
        )
      )
      .where(
        and(
          eq(invoices.id, data.invoiceId),
          eq(invoices.workspaceId, auth.workspaceId),
          isNull(invoices.deletedAt)
        )
      )
      .limit(1);

    if (invoiceRows.length === 0) {
      return null;
    }

    const { invoice, client, contact } = invoiceRows[0];

    const itemsRows = await db
      .select()
      .from(invoiceItems)
      .where(
        and(
          eq(invoiceItems.invoiceId, invoice.id),
          eq(invoiceItems.workspaceId, auth.workspaceId)
        )
      )
      .orderBy(invoiceItems.position);

    return {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        currency: invoice.currency,
        subtotalCents: invoice.subtotalCents,
        taxCents: invoice.taxCents,
        discountCents: invoice.discountCents,
        totalCents: invoice.totalCents,
        amountPaidCents: invoice.amountPaidCents,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        notes: invoice.notes,
        terms: invoice.terms,
        createdAt: invoice.createdAt.toISOString(),
      },
      client: client
        ? {
            id: client.id,
            companyName: client.companyName,
            website: client.website,
            contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
            contactEmail: contact ? contact.email : null,
            contactPhone: contact ? contact.phone : null,
          }
        : null,
      items: itemsRows.map((it) => ({
        id: it.id,
        description: it.description,
        quantity: Number(it.quantity),
        unitPriceCents: it.unitPriceCents,
        amountCents: it.amountCents,
        position: it.position,
      })),
    };
  });

/**
 * Server Function: createInvoiceFn
 * Atomically generates invoice number, validates client ownership, and creates invoice + items inside a transaction.
 */
export const createInvoiceFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createInvoiceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // 1. Verify client belongs to authorized workspace
    const clientRows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.id, data.clientId),
          eq(clients.workspaceId, auth.workspaceId),
          isNull(clients.deletedAt)
        )
      )
      .limit(1);

    if (clientRows.length === 0) {
      throw new Error("Target client does not exist or does not belong to authorized workspace.");
    }

    // 2. Perform atomic transaction: number generation + invoice & items insertion
    return await db.transaction(async (tx) => {
      // Get or create workspace settings for invoice numbering atomically with row lock
      let settingsRows = await tx
        .select()
        .from(workspaceSettings)
        .where(eq(workspaceSettings.workspaceId, auth.workspaceId))
        .for("update")
        .limit(1);

      let prefix = "INV-";
      let nextNumber = 1001;

      if (settingsRows.length === 0) {
        const [newSettings] = await tx
          .insert(workspaceSettings)
          .values({
            workspaceId: auth.workspaceId,
            invoicePrefix: "INV-",
            invoiceNextNumber: 1002,
          })
          .onConflictDoUpdate({
            target: workspaceSettings.workspaceId,
            set: { invoiceNextNumber: sql`${workspaceSettings.invoiceNextNumber} + 1`, updatedAt: new Date() },
          })
          .returning();
        prefix = newSettings.invoicePrefix;
        nextNumber = newSettings.invoiceNextNumber - 1;
      } else {
        const current = settingsRows[0];
        prefix = current.invoicePrefix;
        nextNumber = current.invoiceNextNumber;

        // Increment invoiceNextNumber
        await tx
          .update(workspaceSettings)
          .set({ invoiceNextNumber: nextNumber + 1, updatedAt: new Date() })
          .where(eq(workspaceSettings.id, current.id));
      }

      const generatedInvoiceNumber = `${prefix}${nextNumber}`;

      // Calculate totals
      let subtotalCents = 0;
      const itemsToInsert = data.items.map((item, index) => {
        const amountCents = Math.round(item.quantity * item.unitPriceCents);
        subtotalCents += amountCents;
        return {
          workspaceId: auth.workspaceId,
          description: item.description,
          quantity: item.quantity.toFixed(4),
          unitPriceCents: item.unitPriceCents,
          amountCents,
          position: index,
        };
      });

      const totalCents = Math.max(0, subtotalCents + data.taxCents - data.discountCents);
      const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
      const dueDate = data.dueDate
        ? new Date(data.dueDate)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // Net-14 fallback

      // Insert invoice
      const [newInvoice] = await tx
        .insert(invoices)
        .values({
          workspaceId: auth.workspaceId,
          clientId: data.clientId,
          projectId: data.projectId || null,
          invoiceNumber: generatedInvoiceNumber,
          status: "sent",
          currency: data.currency || "USD",
          subtotalCents,
          taxCents: data.taxCents,
          discountCents: data.discountCents,
          totalCents,
          amountPaidCents: 0,
          issueDate,
          dueDate,
          notes: data.notes || null,
          terms: data.terms || null,
          createdBy: auth.userId,
        })
        .returning();

      // Insert invoice items with newly generated invoice.id
      const preparedItems = itemsToInsert.map((item) => ({
        ...item,
        invoiceId: newInvoice.id,
      }));

      await tx.insert(invoiceItems).values(preparedItems);

      // Publish invoice.created domain event
      const { publishDomainEvent } = await import("@/lib/events");
      await publishDomainEvent(
        {
          workspaceId: auth.workspaceId,
          eventType: "invoice.created",
          aggregateType: "invoice",
          aggregateId: newInvoice.id,
          actorId: auth.userId,
          payload: {
            invoiceId: newInvoice.id,
            invoiceNumber: newInvoice.invoiceNumber,
            clientId: newInvoice.clientId,
            projectId: newInvoice.projectId,
            totalCents: newInvoice.totalCents,
            currency: newInvoice.currency,
            issueDate: newInvoice.issueDate.toISOString(),
            dueDate: newInvoice.dueDate.toISOString(),
            status: newInvoice.status,
            createdBy: auth.userId,
          },
        },
        tx
      );

      return {
        id: newInvoice.id,
        invoiceNumber: newInvoice.invoiceNumber,
        totalCents: newInvoice.totalCents,
        status: newInvoice.status,
        issueDate: newInvoice.issueDate.toISOString(),
        dueDate: newInvoice.dueDate.toISOString(),
      };
    });
  });

/**
 * Server Function: getPaymentsFn
 * Retrieves all transaction ledger entries (incoming client payments and outgoing expenses)
 * for the authorized workspace.
 */
export const getPaymentsFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getPaymentsInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // 1. Fetch incoming invoice payments
    const paymentRows = await db
      .select({
        payment: payments,
        invoice: {
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
        },
        client: {
          companyName: clients.companyName,
        },
      })
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(eq(payments.workspaceId, auth.workspaceId))
      .orderBy(desc(payments.paidAt));

    // 2. Fetch outgoing business expenses
    const expenseRows = await db
      .select({
        expense: expenses,
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(expenses)
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .where(
        and(
          eq(expenses.workspaceId, auth.workspaceId),
          isNull(expenses.deletedAt)
        )
      )
      .orderBy(desc(expenses.expenseDate));

    let incomingCents = 0;
    let outgoingCents = 0;

    const formattedPayments = paymentRows.map(({ payment, invoice, client }) => {
      if (payment.amountCents > 0) {
        incomingCents += payment.amountCents;
      } else {
        outgoingCents += Math.abs(payment.amountCents);
      }

      return {
        id: payment.id,
        clientName: client?.companyName || "Standard Client",
        invoiceNumber: invoice?.invoiceNumber || "N/A",
        amountCents: payment.amountCents,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        transactionReference: payment.transactionReference,
        paidAt: payment.paidAt.toISOString(),
        type: "payment" as const,
        category: "Invoice Payment",
        projectName: null as string | null,
      };
    });

    const formattedExpenses = expenseRows.map(({ expense, project }) => {
      outgoingCents += expense.amountCents;

      return {
        id: expense.id,
        clientName: expense.vendorName || "General Expense",
        invoiceNumber: expense.category,
        amountCents: -Math.abs(expense.amountCents),
        currency: expense.currency,
        paymentMethod: expense.category,
        transactionReference: expense.receiptUrl || null,
        paidAt: expense.expenseDate.toISOString(),
        type: "expense" as const,
        category: expense.category,
        projectName: project?.name || null,
      };
    });

    // Combined sorted ledger: newest first
    const combinedLedger = [...formattedPayments, ...formattedExpenses].sort(
      (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
    );

    const cashAvailableCents = Math.max(0, incomingCents - outgoingCents);

    return {
      payments: combinedLedger,
      stats: {
        cashAvailableCents,
        incomingCents,
        outgoingCents,
      },
    };
  });

/**
 * Server Function: createPaymentFn
 * Records a payment against an authorized invoice and updates invoice status cleanly.
 */
export const createPaymentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createPaymentInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    // 1. Verify invoice belongs to authorized workspace
    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, data.invoiceId),
          eq(invoices.workspaceId, auth.workspaceId),
          isNull(invoices.deletedAt)
        )
      )
      .limit(1);

    if (invoiceRows.length === 0) {
      throw new Error("Target invoice does not exist or does not belong to authorized workspace.");
    }

    const invoice = invoiceRows[0];

    const { publishDomainEvent } = await import("@/lib/events");

    return await db.transaction(async (tx) => {
      // 2. Insert payment entry
      const [newPayment] = await tx
        .insert(payments)
        .values({
          workspaceId: auth.workspaceId,
          invoiceId: invoice.id,
          amountCents: data.amountCents,
          currency: invoice.currency,
          paymentMethod: data.paymentMethod,
          transactionReference: data.transactionReference || null,
          paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
          createdBy: auth.userId,
        })
        .returning();

      // 3. Update invoice amountPaidCents and status
      const updatedPaidCents = invoice.amountPaidCents + data.amountCents;
      const isFullyPaid = updatedPaidCents >= invoice.totalCents;

      await tx
        .update(invoices)
        .set({
          amountPaidCents: updatedPaidCents,
          status: isFullyPaid ? "paid" : "partially_paid",
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoice.id));

      // 4. Publish payment.created domain event
      await publishDomainEvent(
        {
          workspaceId: auth.workspaceId,
          eventType: "payment.created",
          aggregateType: "payment",
          aggregateId: newPayment.id,
          actorId: auth.userId,
          payload: {
            paymentId: newPayment.id,
            invoiceId: invoice.id,
            amountCents: newPayment.amountCents,
            paymentMethod: newPayment.paymentMethod,
            paidAt: newPayment.paidAt.toISOString(),
            createdBy: auth.userId,
          },
        },
        tx
      );

      // 5. Publish invoice.paid domain event if status transitioned to fully paid
      if (isFullyPaid && invoice.status !== "paid") {
        await publishDomainEvent(
          {
            workspaceId: auth.workspaceId,
            eventType: "invoice.paid",
            aggregateType: "invoice",
            aggregateId: invoice.id,
            actorId: auth.userId,
            payload: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              clientId: invoice.clientId,
              totalCents: invoice.totalCents,
              paidAt: newPayment.paidAt.toISOString(),
            },
          },
          tx
        );
      }

      return {
        paymentId: newPayment.id,
        invoiceId: invoice.id,
        amountCents: newPayment.amountCents,
        isFullyPaid,
      };
    });
  });

/**
 * Server Function: updateInvoiceStatusFn
 * Updates the lifecycle status of an authorized invoice (draft, sent, paid, overdue, cancelled).
 */
export const updateInvoiceStatusFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateInvoiceStatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("[SILEX Security Guard] Execution prohibited in browser context.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, data.invoiceId),
          eq(invoices.workspaceId, auth.workspaceId),
          isNull(invoices.deletedAt)
        )
      )
      .limit(1);

    if (invoiceRows.length === 0) {
      throw new Error("Target invoice does not exist or does not belong to authorized workspace.");
    }

    const invoice = invoiceRows[0];

    const updates: Partial<typeof invoices.$inferInsert> = {
      status: data.status,
      updatedAt: new Date(),
    };

    if (data.status === "paid" && invoice.amountPaidCents < invoice.totalCents) {
      updates.amountPaidCents = invoice.totalCents;
    }

    const [updated] = await db
      .update(invoices)
      .set(updates)
      .where(eq(invoices.id, invoice.id))
      .returning();

    // If transitioned to paid, publish invoice.paid domain event
    if (data.status === "paid" && invoice.status !== "paid") {
      const { publishDomainEvent } = await import("@/lib/events");
      await publishDomainEvent({
        workspaceId: auth.workspaceId,
        eventType: "invoice.paid",
        aggregateType: "invoice",
        aggregateId: invoice.id,
        actorId: auth.userId,
        payload: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          totalCents: invoice.totalCents,
          paidAt: new Date().toISOString(),
        },
      });
    }

    return {
      id: updated.id,
      invoiceNumber: updated.invoiceNumber,
      status: updated.status,
      totalCents: updated.totalCents,
      amountPaidCents: updated.amountPaidCents,
    };
  });
