import { NextRequest, NextResponse } from "next/server";
import { listDeals } from "@/lib/db/deals";
import type { DealWithContact } from "@/types";
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
  const overlapEnd = dealEnd < periodEnd ? dealEnd : periodEnd;
  if (overlapEnd <= overlapStart) return 0;
  return Math.max(1, monthsBetween(overlapStart, overlapEnd));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  const now = new Date();
  const periodStart = startParam ? new Date(startParam) : new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = endParam ? new Date(endParam) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [stages, allDeals] = await Promise.all([getStages(), listDeals()]);

  const wonStageIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));

  const result: Array<{
    id: string;
    title: string;
    contactName: string | null;
    value: number;
    isRecurring: boolean;
    recurringMonths: number | null;
    revenueContribution: number;
    overlapMonths: number | null;
    wonAt: string | null;
    isPaid: boolean;
  }> = [];

  for (const d of allDeals) {
    if (!wonStageIds.has(d.stageId)) continue;
    if (!d.isRecurring && !d.isPaid) continue;

    if (!d.isRecurring) {
      const wonMs = toMs(d.wonAt as Date | number | null) || toMs(d.updatedAt as Date | number | null);
      if (wonMs >= periodStart.getTime() && wonMs <= periodEnd.getTime()) {
        result.push({
          id: d.id,
          title: d.title,
          contactName: (d as DealWithContact).contactName ?? null,
          value: d.value,
          isRecurring: false,
          recurringMonths: null,
          revenueContribution: d.value,
          overlapMonths: null,
          wonAt: d.wonAt ? new Date(toMs(d.wonAt as Date | number | null)).toISOString() : null,
          isPaid: d.isPaid ?? false,
        });
      }
    } else {
      const startMs =
        toMs(d.recurringStartDate as Date | number | null) ||
        toMs(d.wonAt as Date | number | null) ||
        toMs(d.createdAt as Date | number | null);
      if (!startMs) continue;
      const dStart = new Date(startMs);
      const recurMonths = d.recurringMonths ?? 12;
      const overlap = clampMonths(dStart, recurMonths, periodStart, periodEnd);
      if (overlap > 0) {
        result.push({
          id: d.id,
          title: d.title,
          contactName: (d as DealWithContact).contactName ?? null,
          value: d.value,
          isRecurring: true,
          recurringMonths: recurMonths,
          revenueContribution: d.value * overlap,
          overlapMonths: overlap,
          wonAt: d.wonAt ? new Date(toMs(d.wonAt as Date | number | null)).toISOString() : null,
          isPaid: d.isPaid ?? false,
        });
      }
    }
  }

  result.sort((a, b) => b.revenueContribution - a.revenueContribution);

  return NextResponse.json({ deals: result });
}
