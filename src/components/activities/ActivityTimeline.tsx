"use client";

import { useState, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, toMs } from "@/lib/utils";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/constants";
import type { ActivityType } from "@/types";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  contactName: string | null;
  contactId: string;
  dealId?: string | null;
  scheduledAt?: Date | number | string | null;
  startAt?: Date | number | string | null;
  endAt?: Date | number | string | null;
  completedAt?: Date | number | string | null;
  notes?: string | null;
  attachments?: string | null;
  isCompleted?: boolean;
  assignedTo?: string | null;
}

interface TimelineProps {
  activities: ActivityItem[];
  users: Record<string, string>;
  onEdit: (activity: ActivityItem) => void;
}

export function ActivityTimeline({ activities, users, onEdit }: TimelineProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { bars, minMs, maxMs } = useMemo(() => {
    const items = activities
      .map((a) => {
        const startMs = a.startAt
          ? toMs(a.startAt)
          : a.scheduledAt
          ? toMs(a.scheduledAt)
          : 0;
        const endMs = a.endAt
          ? toMs(a.endAt)
          : startMs
          ? startMs + 3600000
          : 0;
        if (!startMs) return null;
        return { ...a, startMs, endMs };
      })
      .filter(Boolean) as (ActivityItem & { startMs: number; endMs: number })[];

    const allMs = items.flatMap((i) => [i.startMs, i.endMs]);
    const min = allMs.length ? Math.min(...allMs) : Date.now();
    const max = allMs.length ? Math.max(...allMs) : Date.now() + 86400000;
    return { bars: items, minMs: min, maxMs: max };
  }, [activities]);

  const totalMs = Math.max(maxMs - minMs, 86400000);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {format(weekStart, "d MMM", { locale: it })} — {format(weekEnd, "d MMM yyyy", { locale: it })}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, -7))} className="cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="cursor-pointer">
            Oggi
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 7))} className="cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto border rounded-lg">
        <div className="min-w-[700px] p-4">
          {/* Header giorni */}
          <div className="flex border-b pb-2 mb-3">
            <div className="w-40 shrink-0 text-xs font-medium text-muted-foreground">Attività</div>
            <div className="flex-1 flex">
              {days.map((d) => (
                <div key={d.toISOString()} className="flex-1 text-center text-xs font-medium text-muted-foreground">
                  {format(d, "EEE d", { locale: it })}
                </div>
              ))}
            </div>
          </div>

          {/* Bars */}
          <div className="space-y-2">
            {bars.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessuna attività con data di inizio nelle attività.
              </p>
            )}
            {bars.map((bar) => {
              const config = ACTIVITY_TYPE_CONFIG[bar.type as ActivityType];
              const leftPct = Math.max(0, Math.min(100, ((bar.startMs - minMs) / totalMs) * 100));
              const widthPct = Math.max(2, Math.min(100 - leftPct, ((bar.endMs - bar.startMs) / totalMs) * 100));

              return (
                <div key={bar.id} className="flex items-center">
                  <div className="w-40 shrink-0 pr-3">
                    <p className="text-xs font-medium truncate">{bar.description}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{bar.contactName}</p>
                  </div>
                  <div className="flex-1 relative h-8 bg-muted/30 rounded overflow-hidden">
                    <button
                      onClick={() => onEdit(bar)}
                      className={cn(
                        "absolute top-1 h-6 rounded text-[10px] px-2 truncate cursor-pointer hover:opacity-90 transition-opacity text-left",
                        bar.isCompleted ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                      )}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={`${config?.label || bar.type}: ${bar.description}`}
                    >
                      {config?.label || bar.type}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
