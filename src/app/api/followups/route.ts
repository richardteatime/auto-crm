import { NextRequest, NextResponse } from "next/server";
import { listActivities } from "@/lib/db/activities";
import { toMs } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  // Get all incomplete activities with scheduled dates
  const pendingFollowups = await listActivities({ isCompleted: false });

  // The activity form stores startAt; older/imported follow-ups only have scheduledAt
  const dueMs = (f: (typeof pendingFollowups)[number]) => toMs(f.startAt ?? f.scheduledAt);
  const now = Date.now();
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const endOfDay = startOfDay + 86400000;

  const categorized = {
    overdue: pendingFollowups.filter((f) => {
      const ms = dueMs(f);
      return ms > 0 && ms < startOfDay;
    }),
    today: pendingFollowups.filter((f) => {
      const ms = dueMs(f);
      return ms >= startOfDay && ms < endOfDay;
    }),
    upcoming: pendingFollowups.filter((f) => {
      const ms = dueMs(f);
      return ms >= endOfDay;
    }),
    unscheduled: pendingFollowups.filter((f) => !dueMs(f)),
  };

  return NextResponse.json(categorized);
}
