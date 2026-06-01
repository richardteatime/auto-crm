// Pure availability calculation for booking links. No I/O here so the logic
// stays deterministic and unit-testable; the route supplies the busy intervals.
//
// Timezone (MVP decision): all times are handled in UTC. A day's "HH:mm"
// window is interpreted as UTC wall-clock and every generated slot carries a
// pre-formatted UTC label, so the public widget shows exactly what the server
// computed and there is no client-vs-server timezone drift. Per-visitor
// timezones are a documented future enhancement.

import type {
  BookingAvailability,
  WeekdayKey,
  DayAvailability,
} from "@/lib/capture/types";
import { defaultAvailability } from "@/lib/capture/defaults";

export interface BusyInterval {
  start: Date;
  end: Date;
}

// Parse the stored availability JSON, backfilling any missing keys from the
// defaults so callers always receive a complete, well-formed object.
export function parseAvailability(raw: string | null | undefined): BookingAvailability {
  const base = defaultAvailability();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<BookingAvailability>;
    return {
      days: { ...base.days, ...(parsed.days ?? {}) },
      bufferBefore:
        typeof parsed.bufferBefore === "number" ? parsed.bufferBefore : base.bufferBefore,
      bufferAfter:
        typeof parsed.bufferAfter === "number" ? parsed.bufferAfter : base.bufferAfter,
      maxPerDay: typeof parsed.maxPerDay === "number" ? parsed.maxPerDay : base.maxPerDay,
    };
  } catch {
    return base;
  }
}

export interface AvailableSlot {
  start: string; // ISO (UTC)
  end: string; // ISO (UTC)
  label: string; // "HH:mm" in UTC
}

// JS getUTCDay(): 0=Sunday … 6=Saturday
const WEEKDAY_BY_JS_DAY: WeekdayKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseHHMM(value: string): { h: number; m: number } {
  const [h, m] = value.split(":").map((p) => Number.parseInt(p, 10));
  return {
    h: Number.isFinite(h) ? h : 0,
    m: Number.isFinite(m) ? m : 0,
  };
}

// Accepts "YYYY-MM-DD" and returns its UTC weekday key, or null if malformed.
export function weekdayKeyOf(dateStr: string): WeekdayKey | null {
  const [y, mo, d] = dateStr.split("-").map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return null;
  }
  const day = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return WEEKDAY_BY_JS_DAY[day] ?? null;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function computeAvailableSlots(params: {
  dateStr: string; // "YYYY-MM-DD"
  availability: BookingAvailability;
  durationMinutes: number;
  busy: BusyInterval[];
  bookedCount: number; // appointments already taken that day (for maxPerDay)
  now?: Date;
}): AvailableSlot[] {
  const { dateStr, availability, durationMinutes, busy } = params;
  const now = params.now ?? new Date();

  if (durationMinutes <= 0) return [];

  if (availability.maxPerDay > 0 && params.bookedCount >= availability.maxPerDay) {
    return [];
  }

  const dayKey = weekdayKeyOf(dateStr);
  if (!dayKey) return [];

  const day: DayAvailability | undefined = availability.days?.[dayKey];
  if (!day || !day.enabled) return [];

  const [y, mo, d] = dateStr.split("-").map((p) => Number.parseInt(p, 10));
  const start = parseHHMM(day.start);
  const end = parseHHMM(day.end);

  const dayStartMs = Date.UTC(y, mo - 1, d, start.h, start.m, 0);
  const dayEndMs = Date.UTC(y, mo - 1, d, end.h, end.m, 0);
  if (dayEndMs <= dayStartMs) return [];

  const durMs = durationMinutes * 60_000;
  const beforeMs = Math.max(0, availability.bufferBefore) * 60_000;
  const afterMs = Math.max(0, availability.bufferAfter) * 60_000;
  const nowMs = now.getTime();

  const slots: AvailableSlot[] = [];

  for (let s = dayStartMs; s + durMs <= dayEndMs; s += durMs) {
    const slotStart = s;
    const slotEnd = s + durMs;

    if (slotStart <= nowMs) continue; // never offer a past slot

    const blockStart = slotStart - beforeMs;
    const blockEnd = slotEnd + afterMs;
    const conflict = busy.some((b) =>
      overlaps(blockStart, blockEnd, b.start.getTime(), b.end.getTime()),
    );
    if (conflict) continue;

    const slotDate = new Date(slotStart);
    slots.push({
      start: slotDate.toISOString(),
      end: new Date(slotEnd).toISOString(),
      label: `${pad2(slotDate.getUTCHours())}:${pad2(slotDate.getUTCMinutes())}`,
    });
  }

  return slots;
}
