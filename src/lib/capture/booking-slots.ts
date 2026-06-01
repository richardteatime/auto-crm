// Server-side slot resolution: gathers the assignee's busy intervals (existing
// appointments for this link + the assignee's calendar events) and delegates
// the pure slot math to computeAvailableSlots. Shared by the availability
// endpoint and the booking endpoint so both agree on what is free.

import { listBookingAppointments, listCalendarEvents } from "@/lib/db";
import {
  computeAvailableSlots,
  parseAvailability,
  type AvailableSlot,
  type BusyInterval,
} from "@/lib/capture/availability";
import type { BookingLink } from "@/lib/capture/types";
import { parseBookingAssignees } from "@/lib/capture/booking-assignees";

const DAY_MS = 24 * 60 * 60 * 1000;

function overlapsDay(start: Date, end: Date, dayStart: number, dayEnd: number): boolean {
  return start.getTime() < dayEnd && dayStart < end.getTime();
}

export async function availableSlotsForDate(
  link: BookingLink,
  date: string, // "YYYY-MM-DD"
): Promise<AvailableSlot[]> {
  const availability = parseAvailability(link.availability);

  const dayStartMs = Date.parse(`${date}T00:00:00.000Z`);
  const dayEndMs = Date.parse(`${date}T23:59:59.999Z`);
  if (Number.isNaN(dayStartMs) || Number.isNaN(dayEndMs)) return [];

  const windowStart = new Date(dayStartMs - DAY_MS);
  const windowEnd = new Date(dayEndMs + DAY_MS);

  const appointmentBusy: BusyInterval[] = [];
  let bookedCount = 0;

  try {
    const [appointments, events] = await Promise.all([
      listBookingAppointments({ bookingLinkId: link.id }),
      listCalendarEvents({ startAfter: windowStart, endBefore: windowEnd }),
    ]);

    for (const a of appointments) {
      if (a.status === "cancelled") continue;
      if (!overlapsDay(a.startAt, a.endAt, dayStartMs, dayEndMs)) continue;
      appointmentBusy.push({ start: a.startAt, end: a.endAt });
      bookedCount += 1; // maxPerDay is enforced per booking link
    }

    const assignees = parseBookingAssignees(link.assignedTo);
    const assigneeCandidates = assignees.length ? assignees : [null];
    const merged = new Map<string, AvailableSlot>();

    for (const assignee of assigneeCandidates) {
      const busy = [...appointmentBusy];
      for (const event of events) {
        if (!overlapsDay(event.startAt, event.endAt, dayStartMs, dayEndMs)) continue;
        if (assignee && !event.assignedTo.includes(assignee)) continue;
        busy.push({ start: event.startAt, end: event.endAt });
      }
      for (const slot of computeAvailableSlots({
        dateStr: date,
        availability,
        durationMinutes: link.durationMinutes,
        busy,
        bookedCount,
      })) {
        merged.set(slot.start, slot);
      }
    }

    return [...merged.values()].sort((a, b) => a.start.localeCompare(b.start));
  } catch (error) {
    // Fail closed: offering slots when calendars cannot be read risks
    // double-booking real appointments.
    throw error;
  }

}
