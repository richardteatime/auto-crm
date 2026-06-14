"use client";

// Public booking widget. Theme-independent inline styles (same approach as
// PublicFormRenderer) so it renders consistently when hosted at /book/[slug].
// Flow: pick a date -> fetch free slots -> pick a slot -> enter contact details
// -> POST to the booking endpoint, which re-validates the slot server-side.

import { useCallback, useEffect, useState } from "react";
import type { WeekdayKey, AvailabilitySlot, BookingAvailability } from "@/lib/capture/types";
import { weekdayKeyOf } from "@/lib/capture/availability";
import { sendPublicAnalytics } from "@/components/capture/PublicAnalyticsTracker";
import { DayScroller } from "./DayScroller";

const PRIMARY = "#2563eb";

interface Slot extends AvailabilitySlot {
  label: string;
}

interface Props {
  assetId: string;
  slug: string;
  durationMinutes: number;
  openDays: WeekdayKey[];
  availability: BookingAvailability;
}

function addDays(iso: string, n: number): string {
  const [y, mo, d] = iso.split("-").map((p) => Number.parseInt(p, 10));
  const date = new Date(Date.UTC(y, mo - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function firstEnabledDate(availability: BookingAvailability): string | null {
  const today = todayIso();
  for (let i = 0; i < 21; i++) {
    const date = addDays(today, i);
    const key = weekdayKeyOf(date);
    if (key && availability.days[key]?.enabled) return date;
  }
  return null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function attribution(): { landingPageId?: string; funnelId?: string; sessionId?: string } {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const out: { landingPageId?: string; funnelId?: string; sessionId?: string } = {};
  const lp = q.get("lp") || q.get("landingPageId");
  const fn = q.get("fn") || q.get("funnelId");
  const sid = q.get("sid") || q.get("sessionId");
  if (lp) out.landingPageId = lp;
  if (fn) out.funnelId = fn;
  if (sid) out.sessionId = sid;
  return out;
}

const inputClass =
  "w-full border px-3 py-2 text-sm outline-none focus:ring-2 transition-shadow";
const fieldStyle: React.CSSProperties = {
  borderRadius: 8,
  background: "#ffffff",
  borderColor: "#d1d5db",
  color: "#0f172a",
};

export function PublicBookingWidget({
  assetId,
  slug,
  durationMinutes,
  availability,
}: Props) {
  const [date, setDate] = useState<string>("");
  useEffect(() => {
    setDate(firstEnabledDate(availability) ?? todayIso());
  }, [availability]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selected, setSelected] = useState<Slot | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSlots = useCallback(
    async (d: string) => {
      if (!d) return;
      setLoadingSlots(true);
      setSelected(null);
      setSlots([]);
      try {
        const res = await fetch(
          `/api/public/booking/${slug}/availability?date=${encodeURIComponent(d)}`,
        );
        const data = await res.json();
        setSlots(Array.isArray(data.slots) ? data.slots : []);
      } catch {
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    loadSlots(date);
  }, [date, loadSlots]);

  // Pre-fill guest details from the URL (e.g. when Cugina opens Leo's booking
  // link from a lead: /book/<slug>?name=&email=&phone=). Runs once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const n = q.get("name");
    const e = q.get("email");
    const p = q.get("phone");
    if (n) setName(n);
    if (e) setEmail(e);
    if (p) setPhone(p);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError("Seleziona un orario.");
      return;
    }
    if (!name.trim()) {
      setError("Il nome è obbligatorio.");
      return;
    }
    if (!email.trim()) {
      setError("L'email è obbligatoria.");
      return;
    }
    setSubmitting(true);
    try {
      sendPublicAnalytics("booking_submit", "booking", assetId, attribution().sessionId);
      const res = await fetch(`/api/public/booking/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: selected.start,
          guestName: name.trim(),
          guestEmail: email.trim(),
          guestPhone: phone.trim() || null,
          notes: notes.trim() || null,
          ...attribution(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // A 409 means the slot was taken between load and submit — refresh.
        if (res.status === 409) loadSlots(date);
        throw new Error(data.error || "Errore durante la prenotazione.");
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setDone(data.successMessage || "Prenotazione confermata!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la prenotazione.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        {done}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border bg-card p-5"
      style={{ ["--tw-ring-color" as string]: PRIMARY }}
    >
      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">
          Seleziona un giorno
        </label>
        <DayScroller
          availability={availability}
          selected={date}
          onSelect={setDate}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-muted-foreground">
          Orari disponibili ({durationMinutes} min)
        </label>
        {loadingSlots ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuno slot disponibile per questa data.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => {
              const active = selected?.start === s.start;
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => {
                    setSelected(s);
                    sendPublicAnalytics("slot_select", "booking", assetId, attribution().sessionId);
                  }}
                  className="rounded-md border px-2 py-1.5 text-sm transition-colors"
                  style={{
                    borderColor: active ? PRIMARY : "#d1d5db",
                    background: active ? PRIMARY : "#ffffff",
                    color: active ? "#ffffff" : "#0f172a",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="space-y-3 border-t pt-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">
              Nome <span style={{ color: PRIMARY }}>*</span>
            </label>
            <input
              className={inputClass}
              style={fieldStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">
              Email <span style={{ color: PRIMARY }}>*</span>
            </label>
            <input
              type="email"
              className={inputClass}
              style={fieldStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">Telefono</label>
            <input
              type="tel"
              className={inputClass}
              style={fieldStyle}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">Note</label>
            <textarea
              className={inputClass}
              style={fieldStyle}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !selected}
        className="w-full px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
        style={{ background: PRIMARY, borderRadius: 8 }}
      >
        {submitting ? "Prenotazione…" : "Conferma prenotazione"}
      </button>
    </form>
  );
}
