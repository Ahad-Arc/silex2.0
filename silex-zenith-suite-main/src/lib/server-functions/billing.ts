import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import {
  workspaces,
  workspaceMembers,
  subscriptions,
  invoices,
  clients,
  projects,
} from "@/db/schema";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { eq, and, isNull, sql, count } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Plan Tier Definitions & Resource Limits
 */
export interface PlanTierConfig {
  id: "free" | "pro" | "enterprise";
  name: string;
  badge?: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  features: string[];
  limits: {
    maxInvoicesPerMonth: number | null;
    maxClients: number | null;
    maxProjects: number | null;
    maxMembers: number | null;
  };
}

export const PLAN_TIERS: Record<string, PlanTierConfig> = {
  free: {
    id: "free",
    name: "Free Trial",
    priceMonthly: 0,
    priceYearly: 0,
    description: "Core features for getting started and evaluating SILEX.",
    features: [
      "Up to 5 invoices / month",
      "Up to 5 CRM clients & notes",
      "Up to 3 active projects",
      "1 workspace member",
      "Standard community support",
    ],
    limits: {
      maxInvoicesPerMonth: 5,
      maxClients: 5,
      maxProjects: 3,
      maxMembers: 1,
    },
  },
  pro: {
    id: "pro",
    name: "SILEX Studio",
    badge: "Most Popular",
    priceMonthly: 19,
    priceYearly: 190,
    description: "Unlimited invoicing, AI superpower, and team collaboration.",
    features: [
      "Unlimited invoices & line items",
      "Unlimited CRM clients & notes",
      "Unlimited active projects & Kanban tasks",
      "Up to 5 team members",
      "AI Zenith Studio & RAG memory",
      "Custom branding & invoice numbering",
      "Domain event automation & webhooks",
    ],
    limits: {
      maxInvoicesPerMonth: null,
      maxClients: null,
      maxProjects: null,
      maxMembers: 5,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 99,
    priceYearly: 990,
    description: "Advanced security, custom RBAC, and dedicated operational scale.",
    features: [
      "Unlimited team members & seats",
      "Unlimited invoices, clients & projects",
      "Developer API keys & outbound webhooks",
      "Custom RBAC roles & permissions",
      "24/7 dedicated priority SLA",
      "Full audit logging & compliance",
    ],
    limits: {
      maxInvoicesPerMonth: null,
      maxClients: null,
      maxProjects: null,
      maxMembers: null,
    },
  },
};

// ----------------------------------------------------------------------------
// Zod Input Schemas
// ----------------------------------------------------------------------------

export const getBillingOverviewInputSchema = z
  .object({
    workspaceId: z.string().uuid("Invalid workspace ID format").optional(),
  })
  .optional();

export const createCheckoutSessionInputSchema = z.object({
  planTier: z.enum(["pro", "enterprise"], {
    errorMap: () => ({ message: "Must select 'pro' or 'enterprise' plan tier." }),
  }),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  workspaceId: z.string().uuid("Invalid workspace ID format").optional(),
});

export const cancelSubscriptionInputSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format").optional(),
});

export const resumeSubscriptionInputSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format").optional(),
});

export const handleStripeWebhookInputSchema = z.object({
  eventType: z.string().min(1, "Event type is required"),
  payload: z.record(z.unknown()),
  signature: z.string().optional(),
});

export type GetBillingOverviewInput = z.infer<typeof getBillingOverviewInputSchema>;
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionInputSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionInputSchema>;
export type ResumeSubscriptionInput = z.infer<typeof resumeSubscriptionInputSchema>;
export type HandleStripeWebhookInput = z.infer<typeof handleStripeWebhookInputSchema>;

// ----------------------------------------------------------------------------
// Helper: Constant-time string comparison for webhook signatures
// ----------------------------------------------------------------------------
export function verifyStripeSignature(
  rawPayload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!rawPayload || !signatureHeader || !secret) return false;

  try {
    // Standard Stripe signature header format: t=timestamp,v1=signature
    const parts = signatureHeader.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const signaturePart = parts.find((p) => p.startsWith("v1="));

    if (!timestampPart || !signaturePart) return false;

    const timestamp = timestampPart.slice(2);
    const signature = signaturePart.slice(3);

    // Compute expected signature: HMAC-SHA256(secret, `${timestamp}.${rawPayload}`)
    const payloadToSign = `${timestamp}.${rawPayload}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(payloadToSign)
      .digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");

    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Server Function: getBillingOverviewFn
// ----------------------------------------------------------------------------
export const getBillingOverviewFn = createServerFn({ method: "GET" })
  .validator((input?: unknown) => getBillingOverviewInputSchema.parse(input))
  .handler(async ({ data }) => {
    // Browser execution guard
    if (typeof window !== "undefined") {
      throw new Error(
        "[SILEX Security Guard] getBillingOverviewFn was invoked in browser context. Must execute on server.",
      );
    }

    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client uninitialized.");
    }

    // 1. Fetch current subscription record
    const [sub] = await db
      .select({
        id: subscriptions.id,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        updatedAt: subscriptions.updatedAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, auth.workspaceId))
      .limit(1);

    // 2. Fetch real resource usage stats
    const [[invoicesCountRes], [clientsCountRes], [projectsCountRes], [membersCountRes]] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(invoices)
          .where(and(eq(invoices.workspaceId, auth.workspaceId), isNull(invoices.deletedAt))),
        db
          .select({ value: count() })
          .from(clients)
          .where(and(eq(clients.workspaceId, auth.workspaceId), isNull(clients.deletedAt))),
        db
          .select({ value: count() })
          .from(projects)
          .where(and(eq(projects.workspaceId, auth.workspaceId), isNull(projects.deletedAt))),
        db
          .select({ value: count() })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, auth.workspaceId),
              eq(workspaceMembers.status, "active"),
            ),
          ),
      ]);

    const activeTier = auth.workspace.planTier || "free";
    const currentPlanConfig = PLAN_TIERS[activeTier] || PLAN_TIERS.free;

    return {
      workspace: {
        id: auth.workspace.id,
        name: auth.workspace.name,
        slug: auth.workspace.slug,
        planTier: activeTier,
      },
      memberRole: auth.memberRole,
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            currentPeriodStart: sub.currentPeriodStart.toISOString(),
            currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            updatedAt: sub.updatedAt.toISOString(),
          }
        : null,
      usage: {
        invoicesCount: Number(invoicesCountRes?.value ?? 0),
        clientsCount: Number(clientsCountRes?.value ?? 0),
        projectsCount: Number(projectsCountRes?.value ?? 0),
        membersCount: Number(membersCountRes?.value ?? 0),
      },
      currentPlan: currentPlanConfig,
      plans: Object.values(PLAN_TIERS),
    };
  });

// ----------------------------------------------------------------------------
// Server Function: createCheckoutSessionFn
// ----------------------------------------------------------------------------
export const createCheckoutSessionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => createCheckoutSessionInputSchema.parse(input))
  .handler(async ({ data }) => {
    // Browser execution guard
    if (typeof window !== "undefined") {
      throw new Error(
        "[SILEX Security Guard] createCheckoutSessionFn was invoked in browser context. Must execute on server.",
      );
    }

    // Role-based authorization: Only Admin or Owner can upgrade or modify subscriptions
    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (!db) {
      throw new Error("Database client uninitialized.");
    }

    const targetPlan = PLAN_TIERS[data.planTier];
    if (!targetPlan) {
      throw new Error(`Invalid plan tier: '${data.planTier}'`);
    }

    // Student-friendly, $0-cost implementation:
    // If STRIPE_SECRET_KEY is configured in production, we can generate a real Stripe Checkout Session URL.
    // In local development or zero-SaaS mode, we persist the subscription and update the workspace planTier directly.
    const isStripeConfigured = !!process.env.STRIPE_SECRET_KEY;

    if (isStripeConfigured && !process.env.VITEST && !process.env.NODE_TEST_CONTEXT) {
      try {
        // Production Stripe API call
        const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            success_url: `${process.env.APP_URL || "https://silex.app"}/app/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.APP_URL || "https://silex.app"}/app/settings?tab=billing`,
            mode: "subscription",
            "client_reference_id": auth.workspaceId,
            "customer_email": auth.appUser.email,
            "metadata[workspaceId]": auth.workspaceId,
            "metadata[planTier]": data.planTier,
          }),
        });

        if (stripeRes.ok) {
          const session = await stripeRes.json();
          return {
            success: true,
            planTier: data.planTier,
            checkoutUrl: session.url,
            simulated: false,
          };
        }
      } catch (stripeErr) {
        console.warn("[SILEX Stripe Checkout API Warning] Falling back to database subscription:", stripeErr);
      }
    }

    // Student-friendly fallback: update database subscription state transactionally
    const now = new Date();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days

    await db.transaction(async (tx) => {
      // 1. Upsert subscription record
      await tx
        .insert(subscriptions)
        .values({
          workspaceId: auth.workspaceId,
          stripeCustomerId: `cus_sim_${auth.workspaceId.slice(0, 8)}`,
          stripeSubscriptionId: `sub_sim_${auth.workspaceId.slice(0, 8)}_${Date.now()}`,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: subscriptions.workspaceId,
          set: {
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            updatedAt: now,
          },
        });

      // 2. Update workspace plan tier
      await tx
        .update(workspaces)
        .set({
          planTier: data.planTier,
          updatedAt: now,
        })
        .where(eq(workspaces.id, auth.workspaceId));
    });

    return {
      success: true,
      planTier: data.planTier,
      checkoutUrl: "/app/settings?tab=billing&upgraded=true",
      simulated: true,
    };
  });

// ----------------------------------------------------------------------------
// Server Function: cancelSubscriptionFn
// ----------------------------------------------------------------------------
export const cancelSubscriptionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => cancelSubscriptionInputSchema.parse(input))
  .handler(async ({ data }) => {
    // Browser execution guard
    if (typeof window !== "undefined") {
      throw new Error(
        "[SILEX Security Guard] cancelSubscriptionFn was invoked in browser context. Must execute on server.",
      );
    }

    // Role-based authorization: Only Admin or Owner can cancel subscriptions
    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (!db) {
      throw new Error("Database client uninitialized.");
    }

    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, auth.workspaceId))
      .limit(1);

    if (!existingSub) {
      throw new Error("No active subscription found to cancel for this workspace.");
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          updatedAt: now,
        })
        .where(eq(subscriptions.workspaceId, auth.workspaceId));
    });

    return {
      success: true,
      cancelAtPeriodEnd: true,
    };
  });

// ----------------------------------------------------------------------------
// Server Function: resumeSubscriptionFn
// ----------------------------------------------------------------------------
export const resumeSubscriptionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => resumeSubscriptionInputSchema.parse(input))
  .handler(async ({ data }) => {
    // Browser execution guard
    if (typeof window !== "undefined") {
      throw new Error(
        "[SILEX Security Guard] resumeSubscriptionFn was invoked in browser context. Must execute on server.",
      );
    }

    // Role-based authorization: Only Admin or Owner can resume subscriptions
    const auth = await requireWorkspaceAccess({
      workspaceId: data.workspaceId,
      requiredRole: "admin",
    });

    if (!db) {
      throw new Error("Database client uninitialized.");
    }

    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, auth.workspaceId))
      .limit(1);

    if (!existingSub) {
      throw new Error("No active subscription found to resume for this workspace.");
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: false,
          updatedAt: now,
        })
        .where(eq(subscriptions.workspaceId, auth.workspaceId));
    });

    return {
      success: true,
      cancelAtPeriodEnd: false,
    };
  });

// ----------------------------------------------------------------------------
// Server Function: handleStripeWebhookFn
// ----------------------------------------------------------------------------
export const handleStripeWebhookFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => handleStripeWebhookInputSchema.parse(input))
  .handler(async ({ data }) => {
    // Browser execution guard
    if (typeof window !== "undefined") {
      throw new Error(
        "[SILEX Security Guard] handleStripeWebhookFn was invoked in browser context. Must execute on server.",
      );
    }

    if (!db) {
      throw new Error("Database client uninitialized.");
    }

    // Verify webhook signature if secret configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && data.signature) {
      const isValid = verifyStripeSignature(
        JSON.stringify(data.payload),
        data.signature,
        webhookSecret,
      );
      if (!isValid) {
        throw new Error("Invalid Stripe webhook signature.");
      }
    }

    const event = data.payload as Record<string, any>;
    const eventType = data.eventType;
    const now = new Date();

    if (
      eventType === "customer.subscription.created" ||
      eventType === "customer.subscription.updated"
    ) {
      const subObject = event.data?.object;
      const workspaceId = subObject?.metadata?.workspaceId;
      const planTier = subObject?.metadata?.planTier || "pro";

      if (workspaceId) {
        const periodStart = subObject.current_period_start
          ? new Date(subObject.current_period_start * 1000)
          : now;
        const periodEnd = subObject.current_period_end
          ? new Date(subObject.current_period_end * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await db.transaction(async (tx) => {
          await tx
            .insert(subscriptions)
            .values({
              workspaceId,
              stripeCustomerId: subObject.customer || `cus_${workspaceId.slice(0, 8)}`,
              stripeSubscriptionId: subObject.id || `sub_${workspaceId.slice(0, 8)}`,
              status: subObject.status || "active",
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: !!subObject.cancel_at_period_end,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: subscriptions.workspaceId,
              set: {
                status: subObject.status || "active",
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: !!subObject.cancel_at_period_end,
                updatedAt: now,
              },
            });

          if (subObject.status === "active") {
            await tx
              .update(workspaces)
              .set({
                planTier: planTier,
                updatedAt: now,
              })
              .where(eq(workspaces.id, workspaceId));
          }
        });
      }
    } else if (eventType === "customer.subscription.deleted") {
      const subObject = event.data?.object;
      const workspaceId = subObject?.metadata?.workspaceId;

      if (workspaceId) {
        await db.transaction(async (tx) => {
          await tx
            .update(subscriptions)
            .set({
              status: "canceled",
              updatedAt: now,
            })
            .where(eq(subscriptions.workspaceId, workspaceId));

          await tx
            .update(workspaces)
            .set({
              planTier: "free",
              updatedAt: now,
            })
            .where(eq(workspaces.id, workspaceId));
        });
      }
    }

    return { received: true };
  });
