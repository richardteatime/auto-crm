import { NextRequest, NextResponse } from "next/server";
import { listContacts } from "@/lib/db/contacts";
import { listDeals } from "@/lib/db/deals";
import { listActivities } from "@/lib/db/activities";
import { listQuotes } from "@/lib/db/quotes";
import { listTasks } from "@/lib/db/tasks";
import { listExpenses } from "@/lib/db/expenses";

export const dynamic = "force-dynamic";

function getTs(val: Date | number | string | null | undefined): number {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "string") {
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  const n = val as number;
  return n < 1e12 ? n * 1000 : n;
}

function parsePeriod(from: string | null, to: string | null) {
  const fromMs = from ? new Date(from + "T00:00:00").getTime() : 0;
  const maxMs = to ? new Date(to + "T23:59:59.999").getTime() : Date.now();
  return { fromMs, maxMs };
}

function inRange(ts: number, fromMs: number, maxMs: number) {
  return ts >= fromMs && ts <= maxMs;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") || "contacts";
  const { fromMs, maxMs } = parsePeriod(
    searchParams.get("from"),
    searchParams.get("to")
  );

  if (section === "contacts") {
    const rows = (await listContacts())
      .filter((c) => inRange(getTs(c.createdAt), fromMs, maxMs));
    return NextResponse.json({
      count: rows.length,
      hot: rows.filter((c) => c.temperature === "hot").length,
      warm: rows.filter((c) => c.temperature === "warm").length,
      cold: rows.filter((c) => c.temperature === "cold").length,
    });
  }

  if (section === "deals") {
    const rows = (await listDeals())
      .filter((d) => inRange(getTs(d.createdAt), fromMs, maxMs));
    const wonRows = rows.filter((d) => {
      const wTs = getTs(d.wonAt as Date | number | null);
      return wTs > 0 && inRange(wTs, fromMs, maxMs);
    });
    return NextResponse.json({
      count: rows.length,
      totalValue: rows.reduce((s, d) => s + d.value, 0),
      wonCount: wonRows.length,
      wonValue: wonRows.reduce((s, d) => s + d.value, 0),
      recurring: rows.filter((d) => d.isRecurring).length,
    });
  }

  if (section === "activities") {
    const rows = (await listActivities())
      .filter((a) => inRange(getTs(a.createdAt), fromMs, maxMs));
    const byType: Record<string, number> = {};
    for (const a of rows) byType[a.type] = (byType[a.type] || 0) + 1;
    return NextResponse.json({
      count: rows.length,
      completed: rows.filter((a) => !!a.completedAt).length,
      open: rows.filter((a) => !a.completedAt).length,
      byType,
    });
  }

  if (section === "quotes") {
    const rows = (await listQuotes())
      .filter((q) => inRange(getTs(q.createdAt), fromMs, maxMs));
    const byStatus: Record<string, number> = {};
    for (const q of rows) byStatus[q.status] = (byStatus[q.status] || 0) + 1;
    let totalValue = 0;
    let acceptedValue = 0;
    for (const q of rows) {
      try {
        const items = JSON.parse(q.items) as { quantity: number; unitPrice: number }[];
        const sub = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        const tot = sub + Math.round((sub * q.vatRate) / 100);
        totalValue += tot;
        if (q.status === "accettato") acceptedValue += tot;
      } catch { /* empty */ }
    }
    const sent =
      (byStatus.inviato || 0) +
      (byStatus.accettato || 0) +
      (byStatus.rifiutato || 0);
    return NextResponse.json({
      count: rows.length,
      byStatus,
      totalValue,
      acceptedValue,
      winRate: sent > 0 ? Math.round(((byStatus.accettato || 0) / sent) * 100) : 0,
    });
  }

  if (section === "tasks") {
    const rows = (await listTasks())
      .filter((t) => inRange(getTs(t.createdAt), fromMs, maxMs));
    const now = Date.now();
    return NextResponse.json({
      count: rows.length,
      done: rows.filter((t) => t.done).length,
      todo: rows.filter((t) => !t.done).length,
      overdue: rows.filter(
        (t) => !t.done && t.dueAt && getTs(t.dueAt as Date | number) < now
      ).length,
    });
  }

  if (section === "finance") {
    const [expRows, allDeals] = await Promise.all([
      listExpenses(),
      listDeals(),
    ]);

    const filteredExp = expRows.filter((e) => inRange(getTs(e.date), fromMs, maxMs));
    const totalExpenses = filteredExp.reduce((s, e) => s + e.amount, 0);

    let revenue = 0;
    let mrr = 0;
    const now = Date.now();

    for (const d of allDeals) {
      const startMs =
        getTs(d.recurringStartDate as Date | number | null) ||
        getTs(d.wonAt as Date | number | null) ||
        getTs(d.createdAt);
      if (!startMs) continue;

      if (d.isRecurring && d.recurringMonths) {
        const endMs = startMs + d.recurringMonths * 30 * 86400000;
        if (endMs > fromMs && startMs < maxMs) {
          const months =
            Math.max(0, Math.min(endMs, maxMs) - Math.max(startMs, fromMs)) /
            (30 * 86400000);
          revenue += Math.round(d.value * months);
          if (startMs <= now && endMs >= now) mrr += d.value;
        }
      } else {
        const wonTs = getTs(d.wonAt as Date | number | null);
        if (!wonTs || !inRange(wonTs, fromMs, maxMs)) continue;
        revenue += d.value;
      }
    }

    return NextResponse.json({
      revenue,
      mrr,
      expenses: totalExpenses,
      cashFlow: revenue - totalExpenses,
      expenseCount: filteredExp.length,
    });
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}
