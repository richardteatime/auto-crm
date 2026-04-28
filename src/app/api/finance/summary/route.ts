import { NextRequest, NextResponse } from "next/server";
import { listDeals } from "@/lib/db/deals";
import { listExpenses } from "@/lib/db/expenses";
import { getStages } from "@/lib/db/pipeline";

export const dynamic = "force-dynamic";

function toMs(d: Date | number | string | null | undefined): number {
  if (!d) return 0;
  if (d instanceof Date) return d.getTime();
  if (typeof d === "string") {
    const parsed = new Date(d).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return d < 1e12 ? d * 1000 : d;
}

function monthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

function clampMonths(dealStart: Date, dealMonths: number, periodStart: Date, periodEnd: Date): number {
  const dealEnd = new Date(dealStart);
  dealEnd.setMonth(dealEnd.getMonth() + dealMonths);
  const overlapStart = dealStart > periodStart ? dealStart : periodStart;
  const overlapEnd   = dealEnd   < periodEnd   ? dealEnd   : periodEnd;
  if (overlapEnd <= overlapStart) return 0;
  return Math.max(1, monthsBetween(overlapStart, overlapEnd));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam   = searchParams.get("end");

  const now = new Date();
  const periodStart = startParam ? new Date(startParam) : new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd   = endParam   ? new Date(endParam)   : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [stages, allDeals, allExpenses] = await Promise.all([
    getStages(),
    listDeals(),
    listExpenses(),
  ]);

  const wonStageIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));

  // One-time won revenue in period (won_at in [start, end])
  let oneTimeRevenue = 0;
  // Recurring MRR (currently active recurring deals)
  let mrr = 0;
  // Recurring revenue in period
  let recurringRevenue = 0;

  for (const d of allDeals) {
    if (!wonStageIds.has(d.stageId)) continue;
    if (!d.isPaid) continue;

    if (!d.isRecurring) {
      const wonMs = toMs(d.wonAt as Date | number | null) || toMs(d.updatedAt as Date | number | null);
      if (wonMs >= periodStart.getTime() && wonMs <= periodEnd.getTime()) {
        oneTimeRevenue += d.value;
      }
    } else {
      // Fallback: use wonAt or createdAt if recurringStartDate was never set
      const startMs =
        toMs(d.recurringStartDate as Date | number | null) ||
        toMs(d.wonAt as Date | number | null) ||
        toMs(d.createdAt as Date | number | null);
      if (!startMs) continue;
      const dStart = new Date(startMs);
      const recurMonths = d.recurringMonths ?? 12;
      const dEnd = new Date(dStart);
      dEnd.setMonth(dEnd.getMonth() + recurMonths);

      // MRR: currently active
      if (dStart <= now && dEnd >= now) mrr += d.value;

      // Recurring revenue in period: months_overlap × monthly_value
      const overlap = clampMonths(dStart, recurMonths, periodStart, periodEnd);
      if (overlap > 0) recurringRevenue += d.value * overlap;
    }
  }

  const totalRevenue = oneTimeRevenue + recurringRevenue;

  // Expenses in period
  let totalExpenses = 0;
  const expenseByCategory: Record<string, number> = {};
  for (const e of allExpenses) {
    const dateMs = toMs(e.date as Date | number | null);
    if (dateMs >= periodStart.getTime() && dateMs <= periodEnd.getTime()) {
      totalExpenses += e.amount;
      expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount;
    }
  }

  // Monthly breakdown for last 12 months
  const monthly: Array<{ month: string; oneTime: number; recurring: number; expenses: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const label  = mStart.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });

    let mOneTime = 0, mRecurring = 0, mExp = 0;

    for (const d of allDeals) {
      if (!wonStageIds.has(d.stageId)) continue;
      if (!d.isPaid) continue;
      if (!d.isRecurring) {
        const wonMs = toMs(d.wonAt as Date | number | null) || toMs(d.updatedAt as Date | number | null);
        if (wonMs >= mStart.getTime() && wonMs <= mEnd.getTime()) mOneTime += d.value;
      } else {
        const startMs =
          toMs(d.recurringStartDate as Date | number | null) ||
          toMs(d.wonAt as Date | number | null) ||
          toMs(d.createdAt as Date | number | null);
        if (!startMs) continue;
        const dStart = new Date(startMs);
        const overlap = clampMonths(dStart, d.recurringMonths ?? 12, mStart, mEnd);
        if (overlap > 0) mRecurring += d.value * overlap;
      }
    }

    for (const e of allExpenses) {
      const dateMs = toMs(e.date as Date | number | null);
      if (dateMs >= mStart.getTime() && dateMs <= mEnd.getTime()) mExp += e.amount;
    }

    monthly.push({ month: label, oneTime: mOneTime, recurring: mRecurring, expenses: mExp });
  }

  return NextResponse.json({
    periodStart: periodStart.toISOString(),
    periodEnd:   periodEnd.toISOString(),
    oneTimeRevenue,
    recurringRevenue,
    totalRevenue,
    mrr,
    totalExpenses,
    cashFlow: totalRevenue - totalExpenses,
    expenseByCategory,
    monthly,
  });
}
