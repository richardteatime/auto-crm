"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/capture/types";
import type {
  BookingAvailability,
  WeekdayKey,
  DayAvailability,
  TimeInterval,
  DateException,
} from "@/lib/capture/types";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function numberOr(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function isValidInterval(i: TimeInterval): boolean {
  return i.start < i.end;
}

function emptyInterval(): TimeInterval {
  return { start: "09:00", end: "18:00" };
}

function emptyException(date = todayIso()): DateException {
  return { date, enabled: true, intervals: [emptyInterval()] };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface IntervalRowProps {
  interval: TimeInterval;
  disabled?: boolean;
  onChange: (next: TimeInterval) => void;
  onRemove: () => void;
}

function IntervalRow({ interval, disabled, onChange, onRemove }: IntervalRowProps) {
  const valid = isValidInterval(interval);
  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        className={cn("h-8 w-28", !valid && "border-red-500")}
        value={interval.start}
        disabled={disabled}
        onChange={(e) => onChange({ ...interval, start: e.target.value })}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        type="time"
        className={cn("h-8 w-28", !valid && "border-red-500")}
        value={interval.end}
        disabled={disabled}
        onChange={(e) => onChange({ ...interval, end: e.target.value })}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface AvailabilityEditorProps {
  availability: BookingAvailability;
  onChange: (next: BookingAvailability) => void;
}

export function AvailabilityEditor({ availability, onChange }: AvailabilityEditorProps) {
  const updateDay = (key: WeekdayKey, patch: Partial<DayAvailability>) => {
    onChange({
      ...availability,
      days: { ...availability.days, [key]: { ...availability.days[key], ...patch } },
    });
  };

  const addInterval = (key: WeekdayKey) => {
    const day = availability.days[key];
    updateDay(key, { intervals: [...day.intervals, emptyInterval()] });
  };

  const updateInterval = (key: WeekdayKey, index: number, next: TimeInterval) => {
    const day = availability.days[key];
    const intervals = [...day.intervals];
    intervals[index] = next;
    updateDay(key, { intervals });
  };

  const removeInterval = (key: WeekdayKey, index: number) => {
    const day = availability.days[key];
    updateDay(key, { intervals: day.intervals.filter((_, i) => i !== index) });
  };

  const exceptions = Object.values(availability.exceptions ?? {}).sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });

  const addException = () => {
    const nextDate = emptyException().date;
    let date = nextDate;
    let counter = 1;
    while (availability.exceptions?.[date]) {
      const d = new Date(`${nextDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + counter);
      date = d.toISOString().slice(0, 10);
      counter++;
    }
    onChange({
      ...availability,
      exceptions: { ...availability.exceptions, [date]: emptyException(date) },
    });
  };

  const updateException = (date: string, patch: Partial<DateException>) => {
    const current = availability.exceptions[date];
    if (!current) return;

    let nextDate = current.date;
    if (typeof patch.date === "string" && patch.date !== current.date) {
      // If moving to a date that already exists, ignore the rename to avoid collisions.
      if (availability.exceptions[patch.date]) return;
      nextDate = patch.date;
    }

    const updated: DateException = { ...current, ...patch, date: nextDate };
    const exceptionsCopy = { ...availability.exceptions };
    if (nextDate !== current.date) {
      delete exceptionsCopy[current.date];
    }
    exceptionsCopy[nextDate] = updated;
    onChange({ ...availability, exceptions: exceptionsCopy });
  };

  const removeException = (date: string) => {
    const exceptionsCopy = { ...availability.exceptions };
    delete exceptionsCopy[date];
    onChange({ ...availability, exceptions: exceptionsCopy });
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Disponibilità settimanale</h2>
        <div className="space-y-3">
          {WEEKDAY_KEYS.map((key) => {
            const day = availability.days[key];
            return (
              <div key={key} className="rounded-md border p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                  />
                  {WEEKDAY_LABELS[key]}
                </label>

                {day.enabled && (
                  <div className="space-y-2 pl-6">
                    {day.intervals.map((interval, idx) => (
                      <IntervalRow
                        key={idx}
                        interval={interval}
                        onChange={(next) => updateInterval(key, idx, next)}
                        onRemove={() => removeInterval(key, idx)}
                      />
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => addInterval(key)}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Aggiungi intervallo
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">Gli orari sono interpretati in UTC.</p>
      </div>

      <div className="space-y-3 pt-2 border-t">
        <h2 className="text-sm font-semibold">Eccezioni per data</h2>
        <p className="text-xs text-muted-foreground">
          Sovrascrivono la disponibilità settimanale per date specifiche (es. festivi, giorni con
          orari particolari).
        </p>

        {exceptions.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessuna eccezione configurata.</p>
        )}

        <div className="space-y-3">
          {exceptions.map((exc) => (
            <div key={exc.date} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="h-8 w-40"
                    value={exc.date}
                    onChange={(e) => updateException(exc.date, { date: e.target.value })}
                  />
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={exc.enabled}
                      onChange={(e) => updateException(exc.date, { enabled: e.target.checked })}
                    />
                    Disponibile
                  </label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeException(exc.date)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {exc.enabled && (
                <div className="space-y-2 pl-0">
                  {exc.intervals.map((interval, idx) => (
                    <IntervalRow
                      key={idx}
                      interval={interval}
                      onChange={(next) => {
                        const intervals = [...exc.intervals];
                        intervals[idx] = next;
                        updateException(exc.date, { intervals });
                      }}
                      onRemove={() => {
                        const intervals = exc.intervals.filter((_, i) => i !== idx);
                        updateException(exc.date, { intervals });
                      }}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      updateException(exc.date, {
                        intervals: [...exc.intervals, emptyInterval()],
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Aggiungi intervallo
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" className="w-full" onClick={addException}>
          <Plus className="h-4 w-4 mr-1" /> Aggiungi eccezione
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t">
        <Field label="Buffer prima (min)">
          <Input
            type="number"
            min={0}
            className="h-8"
            value={availability.bufferBefore}
            onChange={(e) =>
              onChange({
                ...availability,
                bufferBefore: Math.max(0, numberOr(e.target.value, 0)),
              })
            }
          />
        </Field>
        <Field label="Buffer dopo (min)">
          <Input
            type="number"
            min={0}
            className="h-8"
            value={availability.bufferAfter}
            onChange={(e) =>
              onChange({
                ...availability,
                bufferAfter: Math.max(0, numberOr(e.target.value, 0)),
              })
            }
          />
        </Field>
        <Field label="Max al giorno">
          <Input
            type="number"
            min={0}
            className="h-8"
            value={availability.maxPerDay}
            onChange={(e) =>
              onChange({
                ...availability,
                maxPerDay: Math.max(0, numberOr(e.target.value, 0)),
              })
            }
          />
        </Field>
      </div>
    </div>
  );
}
