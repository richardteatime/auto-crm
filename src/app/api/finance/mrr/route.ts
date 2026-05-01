import { NextResponse } from "next/server";
import { listDeals } from "@/lib/db/deals";
import { getStages } from "@/lib/db/pipeline";
import type { DealWithContact } from "@/types";

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

export async function GET() {
  const now = new Date();
  const [stages, allDeals] = await Promise.all([getStages(), listDeals()]);
  const wonStageIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));

  const result: Array<{
    id: string;
    title: string;
    contactName: string | null;
    value: number;
    recurringMonths: number;
    startDate: string;
    endDate: string;
    totalContractValue: number;
    wonAt: string | null;
  }> = [];

  for (const d of allDeals) {
    if (!wonStageIds.has(d.stageId)) continue;
    if (!d.isRecurring) continue;

    const startMs =
      toMs(d.recurringStartDate as Date | number | null) ||
      toMs(d.wonAt as Date | number | null) ||
      toMs(d.createdAt as Date | number | null);
    if (!startMs) continue;

    const dStart = new Date(startMs);
    const recurMonths = d.recurringMonths ?? 12;
    const dEnd = new Date(dStart);
    dEnd.setMonth(dEnd.getMonth() + recurMonths);

    // Only currently active
    if (dStart > now || dEnd < now) continue;

    result.push({
      id: d.id,
      title: d.title,
      contactName: (d as DealWithContact).contactName ?? null,
      value: d.value,
      recurringMonths: recurMonths,
      startDate: dStart.toISOString(),
      endDate: dEnd.toISOString(),
      totalContractValue: d.value * recurMonths,
      wonAt: d.wonAt ? new Date(toMs(d.wonAt as Date | number | null)).toISOString() : null,
    });
  }

  result.sort((a, b) => b.value - a.value);

  const totalMrr = result.reduce((s, d) => s + d.value, 0);

  return NextResponse.json({ deals: result, totalMrr });
}
