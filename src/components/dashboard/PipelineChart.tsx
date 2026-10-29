import Link from "next/link";
import { Trophy } from "lucide-react";
import { formatCurrencyShort } from "@/lib/constants";
import type { StageBar } from "@/lib/dashboard";

/** Horizontal funnel: one bar per stage, width proportional to the stage value */
export function PipelineChart({ stages, lostCount }: { stages: StageBar[]; lostCount: number }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  const total = stages.filter((s) => !s.isWon).reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {stages.map((s, i) => {
          const pct = Math.max(s.value > 0 ? 4 : 0, Math.round((s.value / max) * 100));
          return (
            <li key={s.id}>
              <Link
                href="/pipeline"
                className="group grid grid-cols-[minmax(84px,132px)_1fr_auto] items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-muted/50"
              >
                <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.name}</span>
                  {s.isWon && <Trophy className="size-3 shrink-0 text-emerald-500" />}
                </span>
                <span className="relative h-7 overflow-hidden rounded-md bg-muted/70">
                  <span
                    className="absolute inset-y-0 left-0 rounded-md transition-[width] duration-700 ease-out"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: s.color,
                      opacity: 0.88,
                      transitionDelay: `${i * 60}ms`,
                    }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold text-white mix-blend-normal drop-shadow-sm">
                    {s.count > 0 ? `${s.count} ${s.count === 1 ? "trattativa" : "trattative"}` : ""}
                  </span>
                </span>
                <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatCurrencyShort(s.value)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>
          In corso: <span className="font-semibold text-foreground tabular-nums">{formatCurrencyShort(total)}</span>
        </span>
        <span>
          {lostCount} {lostCount === 1 ? "trattativa persa" : "trattative perse"}
        </span>
      </div>
    </div>
  );
}
