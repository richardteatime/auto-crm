import { listCalendarEvents } from "@/lib/db";

export function parseBookingAssignees(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export async function firstFreeBookingAssignee(
  serializedAssignees: string,
  startAt: Date,
  endAt: Date,
): Promise<string | null> {
  const assignees = parseBookingAssignees(serializedAssignees);
  if (assignees.length === 0) return null;

  const events = await listCalendarEvents({ startAfter: startAt, endBefore: endAt });
  return assignees.find((assignee) => !events.some((event) =>
    event.assignedTo.includes(assignee) &&
    event.startAt.getTime() < endAt.getTime() &&
    startAt.getTime() < event.endAt.getTime()
  )) ?? null;
}
