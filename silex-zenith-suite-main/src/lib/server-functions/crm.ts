import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { db } from "@/db";
import { clients, clientContacts, clientNotes } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

// Input Validation Schemas
export const createClientInputSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(255),
  website: z.string().max(500).optional(),
  status: z.string().default("Active"),
  contactName: z.string().max(255).optional(),
  contactEmail: z.string().email("Invalid email format").or(z.literal("")).optional(),
  contactPhone: z.string().max(50).optional(),
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

    return clientRows.map(({ client, contact }) => ({
      id: client.id,
      companyName: client.companyName,
      website: client.website,
      status: client.status,
      createdAt: client.createdAt ? client.createdAt.toISOString() : new Date().toISOString(),
      primaryContact: contact
        ? {
            name: `${contact.firstName} ${contact.lastName}`.trim(),
            email: contact.email,
            phone: contact.phone,
          }
        : null,
    }));
  });

/**
 * Server Function: getClientByIdFn
 * Retrieves a single client record with primary contact and notes for the authorized workspace.
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

    const notesRows = await db
      .select()
      .from(clientNotes)
      .where(
        and(
          eq(clientNotes.clientId, client.id),
          eq(clientNotes.workspaceId, auth.workspaceId),
          isNull(clientNotes.deletedAt),
        ),
      )
      .orderBy(desc(clientNotes.createdAt));

    return {
      client: {
        id: client.id,
        workspaceId: client.workspaceId,
        companyName: client.companyName,
        website: client.website,
        status: client.status,
        createdAt: client.createdAt ? client.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: client.updatedAt ? client.updatedAt.toISOString() : new Date().toISOString(),
      },
      contacts: contactsRows.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        isPrimary: c.isPrimary,
      })),
      notes: notesRows.map((n) => ({
        id: n.id,
        content: n.content,
        isPinned: n.isPinned,
        createdAt: n.createdAt ? n.createdAt.toISOString() : new Date().toISOString(),
      })),
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
          companyName: data.companyName,
          website: data.website || null,
          status: data.status || "Active",
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
          createdAt: newClient.createdAt ? newClient.createdAt.toISOString() : new Date().toISOString(),
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
