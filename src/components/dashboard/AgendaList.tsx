import { MapPin } from "lucide-react";
import { dayLabel, formatTime } from "@/lib/dates";
import type { AgendaItem } from "@/lib/dashboard";

const TYPE_COLOR: Record<string, string> = {
  meeting: "#8b5cf6",
  call: "#0ea5e9",
  activity: "#1467d6",
  travel: "#f59e0b",
  out_of_office: "#94a3b8",
  personal: "#ec4899",
  other: "#64748b",
};

export function AgendaList({ items, nowMs }: { items: AgendaItem[]; nowMs: number }) {
  return (
    <ol className="space-y-1">
      {items.map((e) => {
        const color = e.color || TYPE_COLOR[e.type] || TYPE_COLOR.other;
        const live = e.startMs <= nowMs && e.endMs >= nowMs && !e.allDay;
        return (
          <li key={e.id} className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
            <div className="w-14 shrink-0 text-right">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {dayLabel(e.startMs, nowMs)}
              </p>
              <p className="text-sm font-semibold tabular-nums">{e.allDay ? "Tutto il giorno" : formatTime(e.startMs)}</p>
            </div>
            <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                <span className="truncate">{e.title}</span>
                {live && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-500/12 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
                    <span className="size-1.5 animate-pulse rounded-full bg-current" />
                    In corso
                  </span>
                )}
              </p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {!e.allDay && `${formatTime(e.startMs)}–${formatTime(e.endMs)}`}
                {e.location && (
                  <>
                    <MapPin className="ml-1 size-3 shrink-0" />
                    <span className="truncate">{e.location}</span>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
