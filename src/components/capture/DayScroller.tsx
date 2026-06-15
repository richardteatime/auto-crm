"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { isDateBookable } from "@/lib/capture/availability";
import type { BookingAvailability } from "@/lib/capture/types";

interface DayScrollerProps {
  selected: string;
  onSelect: (date: string) => void;
  availability: BookingAvailability;
  days?: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const [y, mo, d] = iso.split("-").map((p) => Number.parseInt(p, 10));
  const date = new Date(Date.UTC(y, mo - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function formatDay(iso: string): { weekday: string; day: string } {
  const date = new Date(`${iso}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
  const day = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), day };
}

export function DayScroller({
  selected,
  onSelect,
  availability,
  days = 21,
}: DayScrollerProps) {
  const today = todayIso();

  const items = useMemo(() => {
    const list: Array<{ date: string; enabled: boolean }> = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(today, i);
      const enabled = isDateBookable(date, availability);
      list.push({ date, enabled });
    }
    return list;
  }, [today, availability, days]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
      {items.map(({ date, enabled }) => {
        const active = selected === date;
        const { weekday, day } = formatDay(date);
        return (
          <button
            key={date}
            type="button"
            disabled={!enabled}
            onClick={() => enabled && onSelect(date)}
            className={cn(
              "snap-start flex shrink-0 flex-col items-center justify-center rounded-lg border min-w-[4rem] h-16 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : enabled
                  ? "bg-card text-foreground border-border hover:border-primary/60"
                  : "bg-muted/50 text-muted-foreground border-border opacity-50 cursor-not-allowed"
            )}
          >
            <span className="text-[11px] font-medium uppercase">{weekday}</span>
            <span className="text-base font-semibold">{day}</span>
          </button>
        );
      })}
    </div>
  );
}
