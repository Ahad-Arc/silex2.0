import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { db } from "@/db";
import { invoices, payments, clients, projects } from "@/db/schema";
import { eq, and, isNull, gte, lte, desc, sql, inArray } from "drizzle-orm";

export const analyticsTimeframeSchema = z.enum(["7D", "30D", "90D", "YTD", "1Y", "All"]);
export type AnalyticsTimeframe = z.infer<typeof analyticsTimeframeSchema>;

export const getAnalyticsSummaryInputSchema = z.object({
  workspaceId: z.string().optional(),
  timeframe: analyticsTimeframeSchema.default("YTD"),
});

export interface AnalyticsSummaryResponse {
  timeframe: AnalyticsTimeframe;
  kpis: {
    revenueYtdDollars: number;
    revenueGrowthPercent: number;
    newClientsCount: number;
    mrrDollars: number;
    hasRecurringData: boolean;
    avgPayTimeDays: number;
  };
  aiStory: string;
  revenueVsLastYear: Array<{
    m: string;
    a: number; // Current period / year revenue ($)
    b: number; // Previous period / year revenue ($)
  }>;
  outperformingPercent: number;
  revenueMix: Array<{
    n: string;
    v: number; // percentage or value
    amountDollars: number;
    c: string; // color hex/oklch
  }>;
  topClients: Array<{
    n: string;
    v: number; // dollars
  }>;
  forecastNext90Days: Array<{
    x: number;
    y: number;
    l: number;
    u: number;
  }>;
}

/**
 * Server Function: getAnalyticsSummaryFn
 * Generates workspace-isolated, database-backed analytics summary metrics and aggregations.
 */
export const getAnalyticsSummaryFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getAnalyticsSummaryInputSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<AnalyticsSummaryResponse> => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("DATABASE_ERROR: Database client handle is uninitialized.");
    }

    const timeframe = data?.timeframe || "YTD";
    const now = new Date();

    // 1. Calculate Date Range Boundaries based on Timeframe
    let startDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;

    switch (timeframe) {
      case "7D": {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevEndDate = new Date(startDate.getTime());
        prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      }
      case "30D": {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        prevEndDate = new Date(startDate.getTime());
        prevStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      }
      case "90D": {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        prevEndDate = new Date(startDate.getTime());
        prevStartDate = new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      }
      case "YTD": {
        startDate = new Date(now.getFullYear(), 0, 1);
        prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
        prevEndDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      }
      case "1Y": {
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        prevEndDate = new Date(startDate.getTime());
        prevStartDate = new Date(startDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      }
      case "All":
      default: {
        startDate = new Date(0);
        prevStartDate = new Date(0);
        prevEndDate = new Date(0);
        break;
      }
    }

    // 2. Query Payments Cash Revenue (Current Period vs Previous Period)
    const currentPayments = await db
      .select({
        amountCents: payments.amountCents,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.workspaceId, auth.workspaceId),
          gte(payments.paidAt, startDate),
          lte(payments.paidAt, now)
        )
      );

    const prevPayments = await db
      .select({
        amountCents: payments.amountCents,
      })
      .from(payments)
      .where(
        and(
          eq(payments.workspaceId, auth.workspaceId),
          gte(payments.paidAt, prevStartDate),
          lte(payments.paidAt, prevEndDate)
        )
      );

    const totalCurrentRevenueCents = currentPayments.reduce((acc, p) => acc + (p.amountCents || 0), 0);
    const totalPrevRevenueCents = prevPayments.reduce((acc, p) => acc + (p.amountCents || 0), 0);

    const revenueYtdDollars = Math.round(totalCurrentRevenueCents / 100);
    const prevRevenueDollars = Math.round(totalPrevRevenueCents / 100);

    let revenueGrowthPercent = 0;
    if (prevRevenueDollars > 0) {
      revenueGrowthPercent = Math.round(
        ((revenueYtdDollars - prevRevenueDollars) / prevRevenueDollars) * 100
      );
    } else if (revenueYtdDollars > 0) {
      revenueGrowthPercent = 100;
    }

    // 3. Query New Clients Count within Timeframe
    const newClientsRows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.workspaceId, auth.workspaceId),
          isNull(clients.deletedAt),
          gte(clients.createdAt, startDate),
          lte(clients.createdAt, now)
        )
      );

    const newClientsCount = newClientsRows.length;

    // 4. MRR (Monthly Recurring Revenue) Audit - Explicit Non-Fabrication
    // CRM Schema has no recurring client subscription contract; returns $0 with hasRecurringData: false.
    const mrrDollars = 0;
    const hasRecurringData = false;

    // 5. Query Average Payment Time (Days from invoice issue_date to payment paid_at)
    const paidInvoicesRows = await db
      .select({
        invoiceId: invoices.id,
        issueDate: invoices.issueDate,
        paidAt: payments.paidAt,
      })
      .from(invoices)
      .innerJoin(payments, eq(payments.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.workspaceId, auth.workspaceId),
          isNull(invoices.deletedAt)
        )
      );

    let avgPayTimeDays = 0;
    if (paidInvoicesRows.length > 0) {
      const totalDays = paidInvoicesRows.reduce((acc, row) => {
        const issue = new Date(row.issueDate).getTime();
        const paid = new Date(row.paidAt).getTime();
        const diffDays = Math.max(0, (paid - issue) / (1000 * 60 * 60 * 24));
        return acc + diffDays;
      }, 0);
      avgPayTimeDays = Number((totalDays / paidInvoicesRows.length).toFixed(1));
    }

    // 6. Monthly Revenue Trend (12 Months comparison: Current vs Previous Year)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    // Fetch all payments for this year and last year
    const twoYearPayments = await db
      .select({
        amountCents: payments.amountCents,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.workspaceId, auth.workspaceId),
          gte(payments.paidAt, new Date(lastYear, 0, 1))
        )
      );

    const thisYearMonthly = Array(12).fill(0);
    const lastYearMonthly = Array(12).fill(0);

    for (const p of twoYearPayments) {
      const d = new Date(p.paidAt);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const amtDollars = (p.amountCents || 0) / 100;

      if (yr === currentYear) {
        thisYearMonthly[mo] += amtDollars;
      } else if (yr === lastYear) {
        lastYearMonthly[mo] += amtDollars;
      }
    }

    // Build 12-month array starting 11 months ago up to current month
    const revenueVsLastYear: Array<{ m: string; a: number; b: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const moIdx = targetDate.getMonth();
      const isCurrentYear = targetDate.getFullYear() === currentYear;

      revenueVsLastYear.push({
        m: monthNames[moIdx],
        a: isCurrentYear ? Math.round(thisYearMonthly[moIdx]) : 0,
        b: Math.round(lastYearMonthly[moIdx]),
      });
    }

    const outperformingPercent = revenueGrowthPercent;

    // 7. Revenue Mix (Breakdown of Total Invoiced Value by Status)
    const allWorkspaceInvoices = await db
      .select({
        status: invoices.status,
        totalCents: invoices.totalCents,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, auth.workspaceId),
          isNull(invoices.deletedAt)
        )
      );

    const statusTotals: Record<string, number> = {
      paid: 0,
      sent: 0,
      overdue: 0,
      draft: 0,
    };

    let grandTotalInvoicedCents = 0;
    for (const inv of allWorkspaceInvoices) {
      const st = (inv.status || "draft").toLowerCase();
      const cents = inv.totalCents || 0;
      grandTotalInvoicedCents += cents;

      if (st === "paid") {
        statusTotals.paid += cents;
      } else if (st === "sent" || st === "pending") {
        statusTotals.sent += cents;
      } else if (st === "overdue") {
        statusTotals.overdue += cents;
      } else {
        statusTotals.draft += cents;
      }
    }

    const grandTotalDollars = grandTotalInvoicedCents / 100;

    const revenueMix = [
      {
        n: "Paid",
        v: grandTotalDollars > 0 ? Math.round((statusTotals.paid / 100 / grandTotalDollars) * 100) : 0,
        amountDollars: Math.round(statusTotals.paid / 100),
        c: "oklch(0.65 0.15 155)", // Emerald
      },
      {
        n: "Pending (Sent)",
        v: grandTotalDollars > 0 ? Math.round((statusTotals.sent / 100 / grandTotalDollars) * 100) : 0,
        amountDollars: Math.round(statusTotals.sent / 100),
        c: "oklch(0.58 0.28 295)", // Violet
      },
      {
        n: "Overdue",
        v: grandTotalDollars > 0 ? Math.round((statusTotals.overdue / 100 / grandTotalDollars) * 100) : 0,
        amountDollars: Math.round(statusTotals.overdue / 100),
        c: "oklch(0.62 0.22 25)", // Rose
      },
      {
        n: "Draft",
        v: grandTotalDollars > 0 ? Math.round((statusTotals.draft / 100 / grandTotalDollars) * 100) : 0,
        amountDollars: Math.round(statusTotals.draft / 100),
        c: "oklch(0.78 0.14 75)", // Amber
      },
    ];

    // 8. Top Clients (Ranked by Total Payments Received)
    const clientRevenueRows = await db
      .select({
        clientName: clients.companyName,
        paidCents: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)`,
      })
      .from(clients)
      .leftJoin(invoices, eq(invoices.clientId, clients.id))
      .leftJoin(payments, eq(payments.invoiceId, invoices.id))
      .where(
        and(
          eq(clients.workspaceId, auth.workspaceId),
          isNull(clients.deletedAt)
        )
      )
      .groupBy(clients.id, clients.companyName)
      .orderBy(desc(sql`COALESCE(SUM(${payments.amountCents}), 0)`))
      .limit(6);

    const topClients = clientRevenueRows.map((r) => ({
      n: r.clientName || "Unknown Client",
      v: Math.round((Number(r.paidCents) || 0) / 100),
    }));

    // 9. Forecast Next 90 Days (Unpaid Invoices Due + Run Rate)
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const upcomingInvoices = await db
      .select({
        totalCents: invoices.totalCents,
        amountPaidCents: invoices.amountPaidCents,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, auth.workspaceId),
          isNull(invoices.deletedAt),
          inArray(invoices.status, ["sent", "overdue", "pending"]),
          lte(invoices.dueDate, in90Days)
        )
      );

    const upcomingUnpaidDollars = upcomingInvoices.reduce((acc, inv) => {
      const remainingCents = Math.max(0, (inv.totalCents || 0) - (inv.amountPaidCents || 0));
      return acc + remainingCents / 100;
    }, 0);

    const baseMonthlyRunRate = revenueYtdDollars > 0 ? Math.round(revenueYtdDollars / 12) : 0;

    const forecastNext90Days = Array.from({ length: 12 }).map((_, i) => {
      const projected = Math.round(baseMonthlyRunRate + (upcomingUnpaidDollars / 12) * (i + 1));
      return {
        x: i + 1,
        y: projected,
        l: Math.round(projected * 0.85),
        u: Math.round(projected * 1.15),
      };
    });

    // 10. AI Story Summary Generation
    let aiStory = "";
    if (revenueYtdDollars > 0 || newClientsCount > 0) {
      aiStory = `YTD revenue is $${revenueYtdDollars.toLocaleString()} across ${newClientsCount} new client(s) with an average payment speed of ${avgPayTimeDays} days.`;
    } else {
      aiStory = `No business performance data has been recorded for this workspace yet. Create invoices or record payments to generate analytics insight.`;
    }

    return {
      timeframe,
      kpis: {
        revenueYtdDollars,
        revenueGrowthPercent,
        newClientsCount,
        mrrDollars,
        hasRecurringData,
        avgPayTimeDays,
      },
      aiStory,
      revenueVsLastYear,
      outperformingPercent,
      revenueMix,
      topClients,
      forecastNext90Days,
    };
  });
