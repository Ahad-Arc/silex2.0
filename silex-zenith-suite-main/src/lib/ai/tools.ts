/**
 * SILEX AI Zenith — Read-Only Tool Registry Engine
 * 
 * Provides authorized, workspace-scoped server tools for Zenith AI query resolution.
 * All tools are strictly READ-ONLY in Milestone 2.3.
 */

import { z } from "zod";
import { getClientsFn, getClientByIdFn } from "@/lib/server-functions/crm";
import { getInvoicesFn, getInvoiceByIdFn, getPaymentsFn } from "@/lib/server-functions/invoices";
import { getProjectsFn, getProjectByIdFn, getDashboardTasksFn } from "@/lib/server-functions/projects";
import { getDocumentsFn, getDocumentByIdFn } from "@/lib/server-functions/documents";

export interface ZenithToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (workspaceId: string, args: any) => Promise<unknown>;
}

/**
 * Registry of authorized read-only SILEX tools.
 */
export const ZENITH_TOOLS: Record<string, ZenithToolDefinition> = {
  getClients: {
    name: "getClients",
    description: "Retrieve active CRM client directory and primary contact details for the workspace.",
    parameters: z.object({
      status: z.string().optional().describe("Optional filter by client status (e.g. Active, Lead)"),
    }),
    execute: async (workspaceId, args) => {
      return getClientsFn({ data: { workspaceId, status: args.status } });
    },
  },

  getClientDetails: {
    name: "getClientDetails",
    description: "Retrieve comprehensive client profile, primary contacts, and client notes by client ID.",
    parameters: z.object({
      clientId: z.string().min(1).describe("The unique ID of the CRM client"),
    }),
    execute: async (workspaceId, args) => {
      return getClientByIdFn({ data: { workspaceId, clientId: args.clientId } });
    },
  },

  getProjects: {
    name: "getProjects",
    description: "Retrieve list of active projects, statuses, and budget information.",
    parameters: z.object({
      status: z.string().optional().describe("Optional status filter (e.g. in_progress, planning)"),
    }),
    execute: async (workspaceId, args) => {
      return getProjectsFn({ data: { workspaceId, status: args.status } });
    },
  },

  getProjectDetails: {
    name: "getProjectDetails",
    description: "Retrieve detailed project specifications, assigned tasks, and project members by project ID.",
    parameters: z.object({
      projectId: z.string().min(1).describe("The unique ID of the project"),
    }),
    execute: async (workspaceId, args) => {
      return getProjectByIdFn({ data: { workspaceId, projectId: args.projectId } });
    },
  },

  getInvoices: {
    name: "getInvoices",
    description: "Retrieve invoice directory, totals, statuses, and due dates.",
    parameters: z.object({
      status: z.string().optional().describe("Optional status filter (e.g. Sent, Paid, Overdue)"),
    }),
    execute: async (workspaceId, args) => {
      return getInvoicesFn({ data: { workspaceId, status: args.status } });
    },
  },

  getInvoiceDetails: {
    name: "getInvoiceDetails",
    description: "Retrieve detailed invoice line items, tax breakdowns, and payment status by invoice ID.",
    parameters: z.object({
      invoiceId: z.string().min(1).describe("The unique ID of the invoice"),
    }),
    execute: async (workspaceId, args) => {
      return getInvoiceByIdFn({ data: { workspaceId, invoiceId: args.invoiceId } });
    },
  },

  getPayments: {
    name: "getPayments",
    description: "Retrieve historical payment ledger transactions for the workspace.",
    parameters: z.object({}),
    execute: async (workspaceId, _args) => {
      return getPaymentsFn({ data: { workspaceId } });
    },
  },

  getDashboardTasks: {
    name: "getDashboardTasks",
    description: "Retrieve pending workspace tasks, due dates, priorities, and assigned projects.",
    parameters: z.object({
      limit: z.number().int().positive().optional().default(10),
    }),
    execute: async (workspaceId, args) => {
      return getDashboardTasksFn({ data: { workspaceId, limit: args.limit } });
    },
  },

  getDocuments: {
    name: "getDocuments",
    description: "Retrieve workspace documents and templates, with optional search query, folder filter, or template filter.",
    parameters: z.object({
      search: z.string().optional().describe("Optional search query to filter documents by title"),
      folderId: z.string().uuid().optional().describe("Optional folder UUID to filter documents"),
      isTemplate: z.boolean().optional().describe("Optional boolean filter for templates"),
    }),
    execute: async (workspaceId, args) => {
      return getDocumentsFn({
        data: {
          workspaceId,
          search: args.search,
          folderId: args.folderId,
          isTemplate: args.isTemplate,
        },
      });
    },
  },

  getDocumentDetails: {
    name: "getDocumentDetails",
    description: "Retrieve comprehensive document content, metadata, and attachments by document ID.",
    parameters: z.object({
      documentId: z.string().uuid().describe("The unique UUID of the document"),
    }),
    execute: async (workspaceId, args) => {
      return getDocumentByIdFn({
        data: {
          workspaceId,
          documentId: args.documentId,
        },
      });
    },
  },
};

/**
 * Returns formatted tool definitions formatted for prompt insertion or tool selection.
 */
export function getToolDefinitionsPrompt(): string {
  return Object.values(ZENITH_TOOLS)
    .map(
      (tool) =>
        `- Tool: ${tool.name}\n  Description: ${tool.description}\n  Parameters JSON Schema: ${JSON.stringify(
          tool.parameters.shape
        )}`
    )
    .join("\n\n");
}
