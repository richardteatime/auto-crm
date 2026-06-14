import { listCalendarEvents, listAppointmentsInRange, getBookingLink } from "@/lib/db";

export function parseBookingAssignees(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export async function firstFreeBookingAssignee(
  serializedAssignees: string,
  startAt: Date,
  endAt: Date,
  currentBookingLinkId?: string,
): Promise<string | null> {
  const assignees = parseBookingAssignees(serializedAssignees);
  if (assignees.length === 0) return null;

  const [events, appointments] = await Promise.all([
    listCalendarEvents({ startAfter: startAt, endBefore: endAt }),
    listAppointmentsInRange(startAt, endAt),
  ]);

  const busyAssignees = new Set<string>();
  const crossLinkIds = new Set<string>();

  for (const a of appointments) {
    if (a.status === "cancelled") continue;
    if (a.startAt.getTime() >= endAt.getTime() || startAt.getTime() >= a.endAt.getTime()) continue;

    if (currentBookingLinkId && a.bookingLinkId === currentBookingLinkId) {
      // Appointments on the current link block all of its assignees (we do
      // not store which assignee was selected for the existing appointment).
      for (const assignee of assignees) busyAssignees.add(assignee);
    } else {
      crossLinkIds.add(a.bookingLinkId);
    }
  }

  if (crossLinkIds.size > 0) {
    const links = await Promise.all([...crossLinkIds].map((id) => getBookingLink(id)));
    const crossAssignees = new Set<string>();
    for (const link of links) {
      if (!link) continue;
      for (const assignee of parseBookingAssignees(link.assignedTo)) {
        crossAssignees.add(assignee);
      }
    }
    for (const assignee of assignees) {
      if (crossAssignees.has(assignee)) busyAssignees.add(assignee);
    }
  }

  for (const event of events) {
    if (event.startAt.getTime() >= endAt.getTime() || startAt.getTime() >= event.endAt.getTime()) continue;
    for (const assignee of assignees) {
      if (event.assignedTo.includes(assignee)) busyAssignees.add(assignee);
    }
  }

  return assignees.find((assignee) => !busyAssignees.has(assignee)) ?? null;
}
