import { z } from "zod";

/**
 * SILEX 2.0 Domain Event Type Constants & Schemas
 */
export const DOMAIN_EVENT_TYPES = [
  "client.created",
  "client.updated",
  "project.created",
  "project.updated",
  "task.created",
  "task.updated",
  "task.completed",
  "invoice.created",
  "invoice.paid",
  "payment.created",
  "comment.created",
  "document.created",
  "document.updated",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export const domainEventTypeSchema = z.enum(DOMAIN_EVENT_TYPES);

/**
 * Bounded, JSON-Safe Domain Event Payloads
 */
export const clientCreatedPayloadSchema = z.object({
  clientId: z.string().min(1),
  companyName: z.string().min(1),
  status: z.string(),
  createdBy: z.string().min(1),
});

export const clientUpdatedPayloadSchema = z.object({
  clientId: z.string().min(1),
  companyName: z.string().min(1),
  status: z.string(),
});

export const projectCreatedPayloadSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  clientId: z.string().nullable().optional(),
  status: z.string(),
  budgetCents: z.number().int().min(0),
  createdBy: z.string().min(1),
});

export const projectUpdatedPayloadSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  status: z.string(),
  budgetCents: z.number().int().min(0).optional(),
});

export const taskCreatedPayloadSchema = z.object({
  taskId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  title: z.string().min(1),
  priority: z.string(),
  status: z.string(),
  dueDate: z.string().nullable().optional(),
  createdBy: z.string().min(1),
});

export const taskUpdatedPayloadSchema = z.object({
  taskId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  title: z.string().min(1),
  priority: z.string().optional(),
  status: z.string().optional(),
});

export const taskCompletedPayloadSchema = z.object({
  taskId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  title: z.string().min(1),
  completedAt: z.string(),
  createdBy: z.string().optional(),
});

export const invoiceCreatedPayloadSchema = z.object({
  invoiceId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  clientId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  totalCents: z.number().int().min(0),
  currency: z.string().default("USD"),
  issueDate: z.string(),
  dueDate: z.string(),
  status: z.string(),
  createdBy: z.string().min(1),
});

export const invoicePaidPayloadSchema = z.object({
  invoiceId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  clientId: z.string().min(1),
  totalCents: z.number().int().min(0),
  paidAt: z.string(),
});

export const paymentCreatedPayloadSchema = z.object({
  paymentId: z.string().min(1),
  invoiceId: z.string().min(1),
  amountCents: z.number().int().positive(),
  paymentMethod: z.string(),
  paidAt: z.string(),
  createdBy: z.string().min(1),
});

export const commentCreatedPayloadSchema = z.object({
  commentId: z.string().min(1),
  taskId: z.string().min(1),
  authorId: z.string().min(1),
  contentSnippet: z.string().max(200),
});

export const documentCreatedPayloadSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().min(1),
  folderId: z.string().nullable().optional(),
  isTemplate: z.boolean().optional(),
  createdBy: z.string().min(1),
});

export const documentUpdatedPayloadSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().min(1),
  folderId: z.string().nullable().optional(),
  isTemplate: z.boolean().optional(),
});

/**
 * Domain Event Publish Parameters Contract
 */
export interface PublishDomainEventParams {
  workspaceId: string;
  eventType: DomainEventType;
  aggregateType: "client" | "project" | "task" | "invoice" | "payment" | "task_comment" | "document";
  aggregateId: string;
  actorId?: string | null;
  payload: Record<string, unknown>;
}

/**
 * Persisted Domain Event Model
 */
export interface DomainEventRecord {
  id: string;
  workspaceId: string;
  eventType: DomainEventType;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Persisted Outbox Event Model
 */
export interface OutboxEventRecord {
  id: string;
  workspaceId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: DomainEventType;
  actorId: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "processed" | "failed";
  retryCount: number;
  errorMessage: string | null;
  createdAt: Date;
  claimedAt: Date | null;
  processedAt: Date | null;
}
