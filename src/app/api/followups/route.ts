import { NextResponse } from "next/server";
import { listActivities } from "@/lib/db/activities";

export async function GET() {
  // Get all incomplete activities with scheduled dates
  const pendingFollowups = await listActivities({ isCompleted: false });

  const now = Date.now() / 1000;

  const categorized = {
    overdue: pendingFollowups.filter((f) => {
      if (!f.scheduledAt) return false;
      const ts =
        typeof f.scheduledAt === "number"
          ? f.scheduledAt
          : f.scheduledAt.getTime() / 1000;
      return ts < now;
    }),
    today: pendingFollowups.filter((f) => {
      if (!f.scheduledAt) return false;
      const ts =
        typeof f.scheduledAt === "number"
          ? f.scheduledAt
          : f.scheduledAt.getTime() / 1000;
      const startOfDay = Math.floor(now / 86400) * 86400;
      const endOfDay = startOfDay + 86400;
      return ts >= startOfDay && ts < endOfDay;
    }),
    upcoming: pendingFollowups.filter((f) => {
      if (!f.scheduledAt) return false;
      const ts =
        typeof f.scheduledAt === "number"
          ? f.scheduledAt
          : f.scheduledAt.getTime() / 1000;
      const endOfDay = (Math.floor(now / 86400) + 1) * 86400;
      return ts >= endOfDay;
    }),
    unscheduled: pendingFollowups.filter((f) => !f.scheduledAt),
  };

  return NextResponse.json(categorized);
}
