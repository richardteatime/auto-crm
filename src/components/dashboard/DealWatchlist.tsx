import Link from "next/link";
import { formatCurrencyShort } from "@/lib/constants";
import { agoLabel, dueLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DealRow } from "@/lib/dashboard";

function ProbabilityRing({ value }: { value: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const tone = value >= 70 ? "text-emerald-500" : value >= 40 ? "text-amber-500" : "text-slate-400";
  return (
    <span className="relative flex size-7 shrink-0 items-center justify-center" title={`Probabilità ${value}%`}>
      <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted" />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
          className={tone}
        />
      </svg>
      <span className="text-[8px] font-bold tabular-nums">{value}</span>
    </span>
  );
}

/** Deals with an expected close date in the next 30 days (or already past) */
export function ClosingSoonList({ deals, nowMs }: { deals: DealRow[]; nowMs: number }) {
  return (
    <ul className="-mx-1 space-y-0.5">
      {deals.map((d) => {
        const late = d.dateMs < nowMs;
        return (
          <li key={d.id}>
            <Link href={`/deals/${d.id}`} className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-muted/50">
              <ProbabilityRing value={d.probability} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.title}</p>
                <p className="truncate text-xs text-muted-foreground">{d.contactName ?? "Senza contatto"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{formatCurrencyShort(d.value)}</p>
                <p className={cn("text-[11px] tabular-nums", late ? "font-medium text-rose-600 dark:text-rose-300" : "text-muted-foreground")}>
                  {late ? `Chiusura prevista ${agoLabel(d.dateMs, nowMs)}` : `Chiude ${dueLabel(d.dateMs, nowMs).toLowerCase()}`}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Open deals nobody touched for a while */
export function StaleDealsList({ deals, nowMs }: { deals: DealRow[]; nowMs: number }) {
  return (
    <ul className="-mx-1 space-y-0.5">
      {deals.map((d) => (
        <li key={d.id}>
          <Link href={`/deals/${d.id}`} className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-muted/50">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: d.stageColor ?? "#94a3b8" }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{d.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {d.stageName ?? "—"} · fermo da {agoLabel(d.dateMs, nowMs).replace(" fa", "")}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrencyShort(d.value)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
