import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { db } from "@/db";
import {
  clients,
  clientContacts,
  clientNotes,
  invoices,
  projects,
  users,
  aiMemory,
} from "@/db/schema";
import { eq, and, isNull, isNotNull, desc, sql } from "drizzle-orm";

// Address validation schema
export const addressSchema = z.object({
  street: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
});

// Input Validation Schemas
export const createClientInputSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(255),
  website: z.string().max(500).optional(),
  status: z.string().default("Active"),
  contactName: z.string().max(255).optional(),
  contactEmail: z.string().email("Invalid email format").or(z.literal("")).optional(),
  contactPhone: z.string().max(50).optional(),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  customFields: z.record(z.any()).optional(),
  workspaceId: z.string().optional(),
});

export const updateClientInputSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  companyName: z.string().min(1, "Company name cannot be empty").max(255).optional(),
  website: z.string().max(500).nullable().optional(),
  status: z.string().max(50).optional(),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  customFields: z.record(z.any()).optional(),
  workspaceId: z.string().optional(),
});

export const deleteClientInputSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  workspaceId: z.string().optional(),
});

export const createClientNoteInputSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  content: z.string().min(1, "Note content cannot be empty").max(10000, "Note content exceeds maximum length"),
  isPinned: z.boolean().optional().default(false),
  workspaceId: z.string().optional(),
});

export const togglePinClientNoteInputSchema = z.object({
  noteId: z.string().min(1, "Note ID is required"),
  clientId: z.string().optional(),
  isPinned: z.boolean().optional(),
  workspaceId: z.string().optional(),
});

export const deleteClientNoteInputSchema = z.object({
  noteId: z.string().min(1, "Note ID is required"),
  clientId: z.string().optional(),
  workspaceId: z.string().optional(),
});

export const createClientContactInputSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email format").max(255),
  phone: z.string().max(50).nullable().optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
  workspaceId: z.string().optional(),
});

export const updateClientContactInputSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  clientId: z.string().min(1, "Client ID is required"),
  firstName: z.string().min(1, "First name cannot be empty").max(100).optional(),
  lastName: z.string().min(1, "Last name cannot be empty").max(100).optional(),
  email: z.string().email("Invalid email format").max(255).optional(),
  phone: z.string().max(50).nullable().optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  isPrimary: z.boolean().optional(),
  workspaceId: z.string().optional(),
});

export const deleteClientContactInputSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  clientId: z.string().min(1, "Client ID is required"),
  workspaceId: z.string().optional(),
});

export const setPrimaryClientContactInputSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  clientId: z.string().min(1, "Client ID is required"),
  workspaceId: z.string().optional(),
});

export const getClientsInputSchema = z.object({
  workspaceId: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});

export const getClientByIdInputSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  workspaceId: z.string().optional(),
});

/**
 * Server Function: getClientsFn
 * Retrieves all active CRM clients belonging strictly to the authorized workspace.
 */
export const getClientsFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getClientsInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const clientRows = await db
      .select({
        client: clients,
        contact: clientContacts,
      })
      .from(clients)
      .leftJoin(
        clientContacts,
        and(
          eq(clientContacts.clientId, clients.id),
          eq(clientContacts.isPrimary, true),
          isNull(clientContacts.deletedAt),
        ),
      )
      .where(
        and(
          eq(clients.workspaceId, auth.workspaceId),
          isNull(clients.deletedAt),
        ),
      )
      .orderBy(desc(clients.createdAt));

    // Query active invoices for this workspace aggregated by client using SQL GROUP BY
    const invoiceAggs = await db
      .select({
        clientId: invoices.clientId,
        totalInvoicedCents: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int`,
        invoicesCount: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, auth.workspaceId),
          isNull(invoices.deletedAt),
          isNotNull(invoices.clientId),
        ),
      )
      .groupBy(invoices.clientId);

    const invoiceStatsByClient: Record<string, { totalInvoicedCents: number; invoicesCount: number }> = {};
    for (const agg of invoiceAggs) {
      if (agg.clientId) {
        invoiceStatsByClient[agg.clientId] = {
          totalInvoicedCents: Number(agg.totalInvoicedCents) || 0,
          invoicesCount: Number(agg.invoicesCount) || 0,
        };
      }
    }

    return clientRows.map(({ client, contact }) => {
      const clientStats = invoiceStatsByClient[client.id] || { totalInvoicedCents: 0, invoicesCount: 0 };
      return {
        id: client.id,
        companyName: client.companyName,
        website: client.website,
        status: client.status,
        createdAt: client.createdAt ? client.createdAt.toISOString() : new Date().toISOString(),
        totalInvoicedCents: clientStats.totalInvoicedCents,
        invoicesCount: clientStats.invoicesCount,
        primaryContact: contact
          ? {
              name: `${contact.firstName} ${contact.lastName}`.trim(),
              email: contact.email,
              phone: contact.phone,
            }
          : null,
      };
    });
  });

/**
 * Server Function: getClientByIdFn
 * Retrieves a single client record with contacts, notes, real invoices, real projects, and financial metrics.
 */
export const getClientByIdFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getClientByIdInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const clientRows = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, data.clientId),
          eq(clients.workspaceId, auth.workspaceId),
          isNull(clients.deletedAt),
        ),
      )
      .limit(1);

    if (clientRows.length === 0) {
      return null;
    }

    const client = clientRows[0];

    // 1. Fetch active contacts
    const contactsRows = await db
      .select()
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.clientId, client.id),
          eq(clientContacts.workspaceId, auth.workspaceId),
          isNull(clientContacts.deletedAt),
        ),
      );

    // 2. Fetch active notes with author information (ordered by pinned first, then newest)
    const notesRows = await db
      .select({
        note: clientNotes,
        author: {
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(clientNotes)
      .leftJoin(users, eq(clientNotes.authorId, users.id))
      .where(
        and(
          eq(clientNotes.clientId, client.id),
          eq(clientNotes.workspaceId, auth.workspaceId),
          isNull(clientNotes.deletedAt),
        ),
      )
      .orderBy(desc(clientNotes.isPinned), desc(clientNotes.createdAt));

    // 3. Fetch real non-deleted invoices associated with this client
    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.clientId, client.id),
          eq(invoices.workspaceId, auth.workspaceId),
          isNull(invoices.deletedAt),
        ),
      )
      .orderBy(desc(invoices.createdAt));

    // 4. Fetch real non-deleted projects associated with this client
    const projectRows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.clientId, client.id),
          eq(projects.workspaceId, auth.workspaceId),
          isNull(projects.deletedAt),
        ),
      )
      .orderBy(desc(projects.createdAt));

    // 5. Calculate real financial metrics from database
    let lifetimeValueCents = 0;
    let totalInvoicedCents = 0;
    let outstandingCents = 0;

    for (const inv of invoiceRows) {
      const total = inv.totalCents || 0;
      const paid = inv.amountPaidCents || 0;
      totalInvoicedCents += total;
      lifetimeValueCents += paid;
      if (inv.status !== "cancelled" && inv.status !== "draft") {
        const balance = total - paid;
        if (balance > 0) {
          outstandingCents += balance;
        }
      }
    }

    const averageInvoiceCents =
      invoiceRows.length > 0 ? Math.round(totalInvoicedCents / invoiceRows.length) : 0;

    return {
      client: {
        id: client.id,
        workspaceId: client.workspaceId,
        companyName: client.companyName,
        website: client.website,
        status: client.status,
        billingAddress: (client.billingAddress || {}) as Record<string, any>,
        shippingAddress: (client.shippingAddress || {}) as Record<string, any>,
        customFields: (client.customFields || {}) as Record<string, any>,
        createdAt: client.createdAt ? client.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: client.updatedAt ? client.updatedAt.toISOString() : new Date().toISOString(),
      },
      contacts: contactsRows.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        jobTitle: c.jobTitle,
        isPrimary: c.isPrimary,
      })),
      notes: notesRows.map(({ note, author }) => ({
        id: note.id,
        content: note.content,
        isPinned: note.isPinned,
        authorId: note.authorId,
        author: {
          name: author?.fullName || "Teammate",
          avatarUrl: author?.avatarUrl || null,
        },
        createdAt: note.createdAt ? note.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: note.updatedAt ? note.updatedAt.toISOString() : new Date().toISOString(),
      })),
      invoices: invoiceRows.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        currency: inv.currency,
        totalCents: inv.totalCents,
        amountPaidCents: inv.amountPaidCents,
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
      projects: projectRows.map((proj) => ({
        id: proj.id,
        name: proj.name,
        code: proj.code,
        status: proj.status,
        budgetCents: proj.budgetCents,
        startDate: proj.startDate ? proj.startDate.toISOString() : null,
        dueDate: proj.dueDate ? proj.dueDate.toISOString() : null,
        createdAt: proj.createdAt.toISOString(),
      })),
      stats: {
        lifetimeValueCents,
        totalInvoicedCents,
        outstandingCents,
        averageInvoiceCents,
        invoicesCount: invoiceRows.length,
        projectsCount: projectRows.length,
      },
    };
  });

/**
 * Server Function: createClientFn
 * Creates a new client and optional primary contact under the authorized workspace.
 */
export const createClientFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createClientInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const { publishDomainEvent } = await import("@/lib/events");

    return await db.transaction(async (tx) => {
      // Insert client record
      const [newClient] = await tx
        .insert(clients)
        .values({
          workspaceId: auth.workspaceId,
          companyName: data.companyName.trim(),
          website: data.website ? data.website.trim() : null,
          status: data.status || "Active",
          billingAddress: data.billingAddress || {},
          shippingAddress: data.shippingAddress || {},
          customFields: data.customFields || {},
          createdBy: auth.userId,
        })
        .returning();

      // Insert contact record if provided
      let newContact = null;
      if (data.contactEmail || data.contactName) {
        const nameParts = (data.contactName || "").trim().split(" ");
        const firstName = nameParts[0] || "Primary";
        const lastName = nameParts.slice(1).join(" ") || "Contact";

        const [contactRow] = await tx
          .insert(clientContacts)
          .values({
            workspaceId: auth.workspaceId,
            clientId: newClient.id,
            firstName,
            lastName,
            email:
              data.contactEmail ||
              `${firstName.toLowerCase()}@${data.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
            phone: data.contactPhone || null,
            isPrimary: true,
          })
          .returning();

        newContact = contactRow;
      }

      // Publish client.created domain event
      await publishDomainEvent(
        {
          workspaceId: auth.workspaceId,
          eventType: "client.created",
          aggregateType: "client",
          aggregateId: newClient.id,
          actorId: auth.userId,
          payload: {
            clientId: newClient.id,
            companyName: newClient.companyName,
            status: newClient.status,
            createdBy: auth.userId,
          },
        },
        tx
      );

      return {
        client: {
          id: newClient.id,
          workspaceId: newClient.workspaceId,
          companyName: newClient.companyName,
          website: newClient.website,
          status: newClient.status,
          billingAddress: (newClient.billingAddress || {}) as Record<string, any>,
          shippingAddress: (newClient.shippingAddress || {}) as Record<string, any>,
          customFields: (newClient.customFields || {}) as Record<string, any>,
          createdAt: newClient.createdAt ? newClient.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: newClient.updatedAt ? newClient.updatedAt.toISOString() : new Date().toISOString(),
        },
        contact: newContact
          ? {
              id: newContact.id,
              firstName: newContact.firstName,
              lastName: newContact.lastName,
              email: newContact.email,
              phone: newContact.phone,
            }
          : null,
      };
    });
  });

/**
 * Server Function: updateClientFn
 * Updates supported fields for an existing client in the authorized workspace.
 */
export const updateClientFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateClientInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const clientRows = await db
      .select()
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
      throw new Error("CLIENT_NOT_FOUND: Client not found or access denied.");
    }

    const updatePayload: Partial<typeof clients.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.companyName !== undefined) updatePayload.companyName = data.companyName.trim();
    if (data.website !== undefined) updatePayload.website = data.website?.trim() || null;
    if (data.status !== undefined) updatePayload.status = data.status.trim();
    if (data.billingAddress !== undefined) updatePayload.billingAddress = data.billingAddress;
    if (data.shippingAddress !== undefined) updatePayload.shippingAddress = data.shippingAddress;
    if (data.customFields !== undefined) updatePayload.customFields = data.customFields;

    const { publishDomainEvent } = await import("@/lib/events");

    const [updatedClient] = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(clients)
        .set(updatePayload)
        .where(
          and(
            eq(clients.id, data.clientId),
            eq(clients.workspaceId, auth.workspaceId),
            isNull(clients.deletedAt)
          )
        )
        .returning();

      await publishDomainEvent(
        {
          workspaceId: auth.workspaceId,
          eventType: "client.updated",
          aggregateType: "client",
          aggregateId: updated.id,
          actorId: auth.userId,
          payload: {
            clientId: updated.id,
            companyName: updated.companyName,
            status: updated.status,
          },
        },
        tx
      );

      return [updated];
    });

    return {
      client: {
        id: updatedClient.id,
        workspaceId: updatedClient.workspaceId,
        companyName: updatedClient.companyName,
        website: updatedClient.website,
        status: updatedClient.status,
        billingAddress: (updatedClient.billingAddress || {}) as Record<string, any>,
        shippingAddress: (updatedClient.shippingAddress || {}) as Record<string, any>,
        customFields: (updatedClient.customFields || {}) as Record<string, any>,
        createdAt: updatedClient.createdAt.toISOString(),
        updatedAt: updatedClient.updatedAt.toISOString(),
      },
    };
  });

/**
 * Server Function: deleteClientFn
 * Soft-deletes a client and its active notes, purging RAG vector memory from ai_memory.
 */
export const deleteClientFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteClientInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const clientRows = await db
      .select()
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
      throw new Error("CLIENT_NOT_FOUND: Client not found or access denied.");
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      // 1. Soft-delete the client
      await tx
        .update(clients)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(clients.id, data.clientId),
            eq(clients.workspaceId, auth.workspaceId)
          )
        );

      // 2. Fetch associated client notes to purge their vector memory
      const noteRows = await tx
        .select({ id: clientNotes.id })
        .from(clientNotes)
        .where(
          and(
            eq(clientNotes.clientId, data.clientId),
            eq(clientNotes.workspaceId, auth.workspaceId),
            isNull(clientNotes.deletedAt)
          )
        );

      // 3. Soft-delete associated notes
      if (noteRows.length > 0) {
        await tx
          .update(clientNotes)
          .set({ deletedAt: now, updatedAt: now })
          .where(
            and(
              eq(clientNotes.clientId, data.clientId),
              eq(clientNotes.workspaceId, auth.workspaceId)
            )
          );

        // 4. Purge vector memory from ai_memory
        for (const note of noteRows) {
          await tx
            .delete(aiMemory)
            .where(
              and(
                eq(aiMemory.workspaceId, auth.workspaceId),
                eq(aiMemory.entityType, "client_note"),
                eq(aiMemory.entityId, note.id)
              )
            );
        }
      }
    });

    return { success: true, clientId: data.clientId };
  });

/**
 * Server Function: createClientNoteFn
 * Creates a client note with authorId derived strictly from auth.userId and indexes it into RAG memory.
 */
export const createClientNoteFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createClientNoteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const clientRows = await db
      .select({ id: clients.id, companyName: clients.companyName })
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
      throw new Error("CLIENT_NOT_FOUND: Client not found or access denied.");
    }

    const [newNote] = await db
      .insert(clientNotes)
      .values({
        workspaceId: auth.workspaceId,
        clientId: data.clientId,
        authorId: auth.userId, // Server-enforced provenance; never trusted from client
        content: data.content.trim(),
        isPinned: data.isPinned ?? false,
      })
      .returning();

    // Auto-index into AI Zenith RAG vector memory
    try {
      const { indexClientNoteFn } = await import("@/lib/server-functions/ai-ingestion");
      await indexClientNoteFn({
        data: { noteId: newNote.id, workspaceId: auth.workspaceId },
      });
    } catch {
      // Ingestion error safety: embedding failures never abort note creation
    }

    // Fetch author details
    const authorRows = await db
      .select({ fullName: users.fullName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    const author = authorRows[0] || { fullName: "Teammate", avatarUrl: null };

    return {
      note: {
        id: newNote.id,
        clientId: newNote.clientId,
        authorId: newNote.authorId,
        author: {
          name: author.fullName,
          avatarUrl: author.avatarUrl,
        },
        content: newNote.content,
        isPinned: newNote.isPinned,
        createdAt: newNote.createdAt.toISOString(),
        updatedAt: newNote.updatedAt.toISOString(),
      },
    };
  });

/**
 * Server Function: togglePinClientNoteFn
 * Toggles or explicitly sets isPinned for an authorized client note.
 */
export const togglePinClientNoteFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => togglePinClientNoteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const noteRows = await db
      .select({
        note: clientNotes,
        client: clients,
        author: {
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(clientNotes)
      .innerJoin(clients, eq(clientNotes.clientId, clients.id))
      .leftJoin(users, eq(clientNotes.authorId, users.id))
      .where(
        and(
          eq(clientNotes.id, data.noteId),
          eq(clientNotes.workspaceId, auth.workspaceId),
          isNull(clientNotes.deletedAt),
          isNull(clients.deletedAt)
        )
      )
      .limit(1);

    if (noteRows.length === 0) {
      throw new Error("NOTE_NOT_FOUND: Client note not found or access denied.");
    }

    const { note, author } = noteRows[0];

    if (data.clientId && note.clientId !== data.clientId) {
      throw new Error("NOTE_MISMATCH: Note does not belong to specified client.");
    }

    const newPinned = typeof data.isPinned === "boolean" ? data.isPinned : !note.isPinned;

    const [updatedNote] = await db
      .update(clientNotes)
      .set({
        isPinned: newPinned,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(clientNotes.id, note.id),
          eq(clientNotes.workspaceId, auth.workspaceId)
        )
      )
      .returning();

    // Re-index note in RAG vector memory to update metadata
    try {
      const { indexClientNoteFn } = await import("@/lib/server-functions/ai-ingestion");
      await indexClientNoteFn({
        data: { noteId: updatedNote.id, workspaceId: auth.workspaceId },
      });
    } catch {
      // Ingestion error safety
    }

    return {
      note: {
        id: updatedNote.id,
        clientId: updatedNote.clientId,
        authorId: updatedNote.authorId,
        author: {
          name: author?.fullName || "Teammate",
          avatarUrl: author?.avatarUrl || null,
        },
        content: updatedNote.content,
        isPinned: updatedNote.isPinned,
        createdAt: updatedNote.createdAt.toISOString(),
        updatedAt: updatedNote.updatedAt.toISOString(),
      },
    };
  });

/**
 * Server Function: deleteClientNoteFn
 * Soft-deletes a client note and purges its vector memory from ai_memory.
 */
export const deleteClientNoteFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteClientNoteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const noteRows = await db
      .select()
      .from(clientNotes)
      .where(
        and(
          eq(clientNotes.id, data.noteId),
          eq(clientNotes.workspaceId, auth.workspaceId),
          isNull(clientNotes.deletedAt)
        )
      )
      .limit(1);

    if (noteRows.length === 0) {
      throw new Error("NOTE_NOT_FOUND: Client note not found or access denied.");
    }

    const note = noteRows[0];

    if (data.clientId && note.clientId !== data.clientId) {
      throw new Error("NOTE_MISMATCH: Note does not belong to specified client.");
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      // 1. Soft-delete note
      await tx
        .update(clientNotes)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(clientNotes.id, note.id),
            eq(clientNotes.workspaceId, auth.workspaceId)
          )
        );

      // 2. Purge vector memory from ai_memory
      await tx
        .delete(aiMemory)
        .where(
          and(
            eq(aiMemory.workspaceId, auth.workspaceId),
            eq(aiMemory.entityType, "client_note"),
            eq(aiMemory.entityId, note.id)
          )
        );
    });

    return { success: true, noteId: data.noteId };
  });

/**
 * Server Function: createClientContactFn
 * Adds a new contact person to a client within the authorized workspace.
 */
export const createClientContactFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => createClientContactInputSchema.parse(d))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("SERVER_ONLY_FUNCTION: This server function cannot be called on the client.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database connection is not available.");
    }

    // Verify client exists and belongs to workspace
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
      throw new Error("CLIENT_NOT_FOUND: Specified client does not exist or access denied.");
    }

    return await db.transaction(async (tx) => {
      // Check existing active contacts for this client
      const existingContacts = await tx
        .select({ id: clientContacts.id })
        .from(clientContacts)
        .where(
          and(
            eq(clientContacts.clientId, data.clientId),
            eq(clientContacts.workspaceId, auth.workspaceId),
            isNull(clientContacts.deletedAt)
          )
        );

      // If no contacts exist yet or caller requested primary, make this contact primary
      const shouldBePrimary = data.isPrimary || existingContacts.length === 0;

      if (shouldBePrimary && existingContacts.length > 0) {
        await tx
          .update(clientContacts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(
            and(
              eq(clientContacts.clientId, data.clientId),
              eq(clientContacts.workspaceId, auth.workspaceId)
            )
          );
      }

      const [newContact] = await tx
        .insert(clientContacts)
        .values({
          workspaceId: auth.workspaceId,
          clientId: data.clientId,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone?.trim() || null,
          jobTitle: data.jobTitle?.trim() || null,
          isPrimary: shouldBePrimary,
        })
        .returning();

      return {
        contact: {
          id: newContact.id,
          clientId: newContact.clientId,
          firstName: newContact.firstName,
          lastName: newContact.lastName,
          email: newContact.email,
          phone: newContact.phone,
          jobTitle: newContact.jobTitle,
          isPrimary: newContact.isPrimary,
          createdAt: newContact.createdAt ? newContact.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: newContact.updatedAt ? newContact.updatedAt.toISOString() : new Date().toISOString(),
        },
      };
    });
  });

/**
 * Server Function: updateClientContactFn
 * Updates details of an existing client contact.
 */
export const updateClientContactFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => updateClientContactInputSchema.parse(d))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("SERVER_ONLY_FUNCTION: This server function cannot be called on the client.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database connection is not available.");
    }

    // Verify contact exists and belongs to authorized workspace & client
    const contactRows = await db
      .select()
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.id, data.contactId),
          eq(clientContacts.clientId, data.clientId),
          eq(clientContacts.workspaceId, auth.workspaceId),
          isNull(clientContacts.deletedAt)
        )
      )
      .limit(1);

    if (contactRows.length === 0) {
      throw new Error("CONTACT_NOT_FOUND: Client contact not found or access denied.");
    }

    const existingContact = contactRows[0];

    return await db.transaction(async (tx) => {
      // If updating to primary, unset existing primary contacts for this client
      if (data.isPrimary && !existingContact.isPrimary) {
        await tx
          .update(clientContacts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(
            and(
              eq(clientContacts.clientId, data.clientId),
              eq(clientContacts.workspaceId, auth.workspaceId)
            )
          );
      }

      const updateValues: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (data.firstName !== undefined) updateValues.firstName = data.firstName.trim();
      if (data.lastName !== undefined) updateValues.lastName = data.lastName.trim();
      if (data.email !== undefined) updateValues.email = data.email.trim().toLowerCase();
      if (data.phone !== undefined) updateValues.phone = data.phone ? data.phone.trim() : null;
      if (data.jobTitle !== undefined) updateValues.jobTitle = data.jobTitle ? data.jobTitle.trim() : null;
      if (data.isPrimary !== undefined) updateValues.isPrimary = data.isPrimary;

      const [updated] = await tx
        .update(clientContacts)
        .set(updateValues)
        .where(
          and(
            eq(clientContacts.id, data.contactId),
            eq(clientContacts.workspaceId, auth.workspaceId)
          )
        )
        .returning();

      return {
        contact: {
          id: updated.id,
          clientId: updated.clientId,
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          phone: updated.phone,
          jobTitle: updated.jobTitle,
          isPrimary: updated.isPrimary,
          createdAt: updated.createdAt ? updated.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: updated.updatedAt ? updated.updatedAt.toISOString() : new Date().toISOString(),
        },
      };
    });
  });

/**
 * Server Function: deleteClientContactFn
 * Soft-deletes a contact person from a client.
 */
export const deleteClientContactFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => deleteClientContactInputSchema.parse(d))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("SERVER_ONLY_FUNCTION: This server function cannot be called on the client.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database connection is not available.");
    }

    const contactRows = await db
      .select()
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.id, data.contactId),
          eq(clientContacts.clientId, data.clientId),
          eq(clientContacts.workspaceId, auth.workspaceId),
          isNull(clientContacts.deletedAt)
        )
      )
      .limit(1);

    if (contactRows.length === 0) {
      throw new Error("CONTACT_NOT_FOUND: Client contact not found or access denied.");
    }

    const contact = contactRows[0];
    const now = new Date();

    return await db.transaction(async (tx) => {
      // 1. Soft-delete the contact
      await tx
        .update(clientContacts)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(clientContacts.id, contact.id),
            eq(clientContacts.workspaceId, auth.workspaceId)
          )
        );

      // 2. If the deleted contact was primary, promote the oldest active contact
      let promotedContactId: string | null = null;
      if (contact.isPrimary) {
        const remainingContacts = await tx
          .select({ id: clientContacts.id })
          .from(clientContacts)
          .where(
            and(
              eq(clientContacts.clientId, data.clientId),
              eq(clientContacts.workspaceId, auth.workspaceId),
              isNull(clientContacts.deletedAt)
            )
          )
          .orderBy(clientContacts.createdAt)
          .limit(1);

        if (remainingContacts.length > 0) {
          promotedContactId = remainingContacts[0].id;
          await tx
            .update(clientContacts)
            .set({ isPrimary: true, updatedAt: now })
            .where(
              and(
                eq(clientContacts.id, promotedContactId),
                eq(clientContacts.workspaceId, auth.workspaceId)
              )
            );
        }
      }

      return {
        success: true,
        contactId: data.contactId,
        promotedContactId,
      };
    });
  });

/**
 * Server Function: setPrimaryClientContactFn
 * Designates a specific contact as the primary contact for a client.
 */
export const setPrimaryClientContactFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => setPrimaryClientContactInputSchema.parse(d))
  .handler(async ({ data }) => {
    if (typeof window !== "undefined") {
      throw new Error("SERVER_ONLY_FUNCTION: This server function cannot be called on the client.");
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database connection is not available.");
    }

    const contactRows = await db
      .select({ id: clientContacts.id })
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.id, data.contactId),
          eq(clientContacts.clientId, data.clientId),
          eq(clientContacts.workspaceId, auth.workspaceId),
          isNull(clientContacts.deletedAt)
        )
      )
      .limit(1);

    if (contactRows.length === 0) {
      throw new Error("CONTACT_NOT_FOUND: Client contact not found or access denied.");
    }

    const now = new Date();

    return await db.transaction(async (tx) => {
      // 1. Clear existing primary contacts for this client
      await tx
        .update(clientContacts)
        .set({ isPrimary: false, updatedAt: now })
        .where(
          and(
            eq(clientContacts.clientId, data.clientId),
            eq(clientContacts.workspaceId, auth.workspaceId)
          )
        );

      // 2. Set target contact as primary
      const [primaryContact] = await tx
        .update(clientContacts)
        .set({ isPrimary: true, updatedAt: now })
        .where(
          and(
            eq(clientContacts.id, data.contactId),
            eq(clientContacts.workspaceId, auth.workspaceId)
          )
        )
        .returning();

      return {
        success: true,
        contact: {
          id: primaryContact.id,
          clientId: primaryContact.clientId,
          firstName: primaryContact.firstName,
          lastName: primaryContact.lastName,
          email: primaryContact.email,
          phone: primaryContact.phone,
          jobTitle: primaryContact.jobTitle,
          isPrimary: primaryContact.isPrimary,
          updatedAt: primaryContact.updatedAt.toISOString(),
        },
      };
    });
  });
