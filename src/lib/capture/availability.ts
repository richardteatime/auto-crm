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
  TimeInterval,
  DateException,
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

    const days: Record<WeekdayKey, DayAvailability> = { ...base.days };
    for (const key of Object.keys(base.days) as WeekdayKey[]) {
      const parsedDay = parsed.days?.[key];
      if (!parsedDay) {
        days[key] = base.days[key];
        continue;
      }

      const enabled = typeof parsedDay.enabled === "boolean" ? parsedDay.enabled : base.days[key].enabled;
      let intervals: TimeInterval[] = base.days[key].intervals;

      if (Array.isArray(parsedDay.intervals) && parsedDay.intervals.length > 0) {
        intervals = parsedDay.intervals.filter(
          (i): i is TimeInterval =>
            typeof i === "object" &&
            i !== null &&
            typeof i.start === "string" &&
            typeof i.end === "string",
        );
      } else if (typeof parsedDay.start === "string" && typeof parsedDay.end === "string") {
        // Legacy migration: single start/end window.
        intervals = [{ start: parsedDay.start, end: parsedDay.end }];
      }

      days[key] = { enabled, intervals };
    }

    const exceptions: Record<string, DateException> = {};
    if (parsed.exceptions && typeof parsed.exceptions === "object") {
      for (const [date, exc] of Object.entries(parsed.exceptions)) {
        if (!exc || typeof exc !== "object") continue;
        const enabled = typeof exc.enabled === "boolean" ? exc.enabled : true;
        const intervals = Array.isArray(exc.intervals)
          ? exc.intervals.filter(
              (i): i is TimeInterval =>
                typeof i === "object" &&
                i !== null &&
                typeof i.start === "string" &&
                typeof i.end === "string",
            )
          : [];
        exceptions[date] = { date, enabled, intervals };
      }
    }

    return {
      days,
      exceptions,
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

function sortAndMergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const valid = intervals.filter((i) => i.start < i.end);
  if (valid.length === 0) return [];
  const sorted = [...valid].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const merged: TimeInterval[] = [sorted[0]!];
  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1]!;
    if (current.start <= last.end) {
      if (current.end > last.end) {
        last.end = current.end;
      }
    } else {
      merged.push(current);
    }
  }
  return merged;
}

// Returns the effective intervals for a given date, resolving date exceptions
// over the weekly schedule. All intervals are sorted and merged.
export function getIntervalsForDate(
  dateStr: string,
  availability: BookingAvailability,
): TimeInterval[] {
  const exception = availability.exceptions?.[dateStr];
  if (exception) {
    if (!exception.enabled) return [];
    return sortAndMergeIntervals(exception.intervals);
  }

  const key = weekdayKeyOf(dateStr);
  if (!key) return [];
  const day = availability.days[key];
  if (!day || !day.enabled) return [];
  return sortAndMergeIntervals(day.intervals);
}

// Returns true if the date has at least one configured interval.
export function isDateBookable(dateStr: string, availability: BookingAvailability): boolean {
  return getIntervalsForDate(dateStr, availability).length > 0;
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

  const intervals = getIntervalsForDate(dateStr, availability);
  if (intervals.length === 0) return [];

  const [y, mo, d] = dateStr.split("-").map((p) => Number.parseInt(p, 10));
  const durMs = durationMinutes * 60_000;
  const beforeMs = Math.max(0, availability.bufferBefore) * 60_000;
  const afterMs = Math.max(0, availability.bufferAfter) * 60_000;
  const nowMs = now.getTime();

  const slots: AvailableSlot[] = [];

  for (const interval of intervals) {
    const start = parseHHMM(interval.start);
    const end = parseHHMM(interval.end);

    const intervalStartMs = Date.UTC(y, mo - 1, d, start.h, start.m, 0);
    const intervalEndMs = Date.UTC(y, mo - 1, d, end.h, end.m, 0);
    if (intervalEndMs <= intervalStartMs) continue;

    for (let s = intervalStartMs; s + durMs <= intervalEndMs; s += durMs) {
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
  }

  return slots;
}
