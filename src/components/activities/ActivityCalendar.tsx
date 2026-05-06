"use client";

import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, toMs } from "@/lib/utils";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/constants";
import type { ActivityType } from "@/types";

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

interface CalendarProps {
  activities: ActivityItem[];
  onEdit: (activity: ActivityItem) => void;
}

export function ActivityCalendar({ activities, onEdit }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const activitiesByDay = useMemo(() => {
    const map: Record<string, ActivityItem[]> = {};
    for (const a of activities) {
      const ms = a.scheduledAt
        ? toMs(a.scheduledAt)
        : a.startAt
        ? toMs(a.startAt)
        : 0;
      if (!ms) continue;
      const key = format(new Date(ms), "yyyy-MM-dd");
      map[key] = map[key] || [];
      map[key].push(a);
    }
    return map;
  }, [activities]);

  const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: it })}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="cursor-pointer">
            Oggi
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayActivities = activitiesByDay[key] || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={key}
              className={cn(
                "min-h-[100px] border rounded-md p-1.5 space-y-1 transition-colors",
                isCurrentMonth ? "bg-background" : "bg-muted/30",
                isToday && "ring-2 ring-primary/20 border-primary"
              )}
            >
              <div className={cn(
                "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}>
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayActivities.slice(0, 3).map((a) => {
                  const config = ACTIVITY_TYPE_CONFIG[a.type as ActivityType];
                  return (
                    <button
                      key={a.id}
                      onClick={() => onEdit(a)}
                      className={cn(
                        "w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80",
                        a.isCompleted ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                      )}
                      title={a.description}
                    >
                      {config?.label || a.type}: {a.description}
                    </button>
                  );
                })}
                {dayActivities.length > 3 && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    +{dayActivities.length - 3} altre
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
