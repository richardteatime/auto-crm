import { NextRequest, NextResponse } from "next/server";
import { listDeals } from "@/lib/db/deals";
import { listRevenues } from "@/lib/db/revenues";
import { requireFinanceOrAdmin } from "@/lib/auth";
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

export async function GET(request: NextRequest) {
  const auth = await requireFinanceOrAdmin(request);
  if (auth.error) return auth.error;

  const now = new Date();
  const [stages, allDeals, allRevenues] = await Promise.all([getStages(), listDeals(), listRevenues()]);
  const wonStageIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));

  const result: Array<{
    id: string;
    title: string;
    contactName: string | null;
    value: number;
    billingType: import("@/types").BillingType;
    recurringMonths: number;
    startDate: string;
    endDate: string;
    totalContractValue: number;
    wonAt: string | null;
  }> = [];

  for (const d of allDeals) {
    if (!wonStageIds.has(d.stageId)) continue;
    if (d.billingType === "una_tantum") continue;

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

    const monthlyValue = d.billingType === "annuale" ? d.value / 12 : d.value;
    result.push({
      id: d.id,
      title: d.title,
      contactName: (d as DealWithContact).contactName ?? null,
      value: monthlyValue,
      billingType: d.billingType,
      recurringMonths: recurMonths,
      startDate: dStart.toISOString(),
      endDate: dEnd.toISOString(),
      totalContractValue: monthlyValue * recurMonths,
      wonAt: d.wonAt ? new Date(toMs(d.wonAt as Date | number | null)).toISOString() : null,
    });
  }

  // Add active recurring external revenues
  for (const r of allRevenues) {
    if (r.deletedAt) continue;
    if (r.billingType === "una_tantum") continue;
    const startMs = toMs(r.startDate) || toMs(r.date) || toMs(r.createdAt);
    if (!startMs) continue;
    const rStart = new Date(startMs);
    const recurMonths = r.recurringMonths ?? 12;
    const rEnd = new Date(rStart);
    rEnd.setMonth(rEnd.getMonth() + recurMonths);
    if (rStart > now || rEnd < now) continue;
    const monthlyValue = r.billingType === "annuale" ? r.amount / 12 : r.amount;
    result.push({
      id: r.id,
      title: r.description,
      contactName: r.isExternal ? "Collaborazione esterna" : null,
      value: monthlyValue,
      billingType: r.billingType,
      recurringMonths: recurMonths,
      startDate: rStart.toISOString(),
      endDate: rEnd.toISOString(),
      totalContractValue: monthlyValue * recurMonths,
      wonAt: r.date ? new Date(toMs(r.date)).toISOString() : null,
    });
  }

  result.sort((a, b) => b.value - a.value);

  const totalMrr = result.reduce((s, d) => s + d.value, 0);
  const monthlyMrr = result.filter((d) => d.billingType === "mensile").reduce((s, d) => s + d.value, 0);
  const annualMrr = result.filter((d) => d.billingType === "annuale").reduce((s, d) => s + d.value, 0);

  return NextResponse.json({ deals: result, totalMrr, monthlyMrr, annualMrr });
}
