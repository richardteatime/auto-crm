"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, Clock, ArrowRight } from "lucide-react";

interface FollowUpData {
  overdue: unknown[];
  today: unknown[];
  upcoming: unknown[];
  unscheduled: unknown[];
}

export function NotificationBanner() {
  const [data, setData] = useState<FollowUpData | null>(null);

  useEffect(() => {
    fetch("/api/followups")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const overdueCount = data.overdue.length;
  const todayCount = data.today.length;

  if (overdueCount === 0 && todayCount === 0) return null;

  return (
    <div className="space-y-2">
      {overdueCount > 0 && (
        <Link href="/activities" className="block">
          <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 transition-colors cursor-pointer">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {overdueCount} follow-up scadut{overdueCount > 1 ? "i" : "o"}
              </p>
              <p className="text-xs text-destructive/70">
                Richiedono attenzione immediata
              </p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-destructive/50" />
          </div>
        </Link>
      )}

      {todayCount > 0 && (
        <Link href="/activities" className="block">
          <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-warning/5 border border-warning/10 hover:bg-warning/10 transition-colors cursor-pointer">
            <Clock className="h-4 w-4 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">
                {todayCount} follow-up per oggi
              </p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-warning/50" />
          </div>
        </Link>
      )}
    </div>
  );
}
