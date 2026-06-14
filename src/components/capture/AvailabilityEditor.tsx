"use client";

import { Input } from "@/components/ui/input";
import { WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/capture/types";
import type { BookingAvailability, WeekdayKey, DayAvailability } from "@/lib/capture/types";

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

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Disponibilità settimanale</h2>
      <div className="space-y-2">
        {WEEKDAY_KEYS.map((key) => {
          const day = availability.days[key];
          return (
            <div key={key} className="flex items-center gap-2">
              <label className="flex w-28 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                />
                {WEEKDAY_LABELS[key]}
              </label>
              <Input
                type="time"
                className="h-8 w-28"
                value={day.start}
                disabled={!day.enabled}
                onChange={(e) => updateDay(key, { start: e.target.value })}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                className="h-8 w-28"
                value={day.end}
                disabled={!day.enabled}
                onChange={(e) => updateDay(key, { end: e.target.value })}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">Gli orari sono interpretati in UTC.</p>

      <div className="grid grid-cols-3 gap-2 pt-2">
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
