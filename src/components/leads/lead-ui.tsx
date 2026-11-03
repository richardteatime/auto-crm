"use client";

import { Phone, MessageCircle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanPhoneForWhatsApp } from "@/lib/constants";
import { LEAD_STATUS_CONFIG, type Lead, type LeadStatus } from "@/lib/leads/types";

export function LeadStatusPill({ status, className }: { status: LeadStatus; className?: string }) {
  const cfg = LEAD_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-background px-2 text-xs font-semibold ring-1 ring-inset ring-border",
        className
      )}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

export function telHref(lead: Pick<Lead, "phone" | "phoneE164">): string | null {
  const n = lead.phoneE164 || lead.phone;
  return n ? `tel:${n.replace(/\s+/g, "")}` : null;
}

export function whatsappHref(lead: Pick<Lead, "phone" | "phoneE164" | "name">, senderFirstName?: string | null): string | null {
  const n = lead.phoneE164 || lead.phone;
  if (!n) return null;
  const first = lead.name.split(/\s+/)[0];
  const text = `Buongiorno ${first}, sono ${senderFirstName || "il team"} di SarconX: la contatto per la richiesta che ci ha inviato. Quando le è comodo sentirci?`;
  return `https://wa.me/${cleanPhoneForWhatsApp(n)}?text=${encodeURIComponent(text)}`;
}

/** "3 min", "1 h 20 min", "2 g" */
export function shortDuration(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  return `${Math.floor(h / 24)} g`;
}

/** Colour for how long a new lead has waited: speed-to-lead matters */
export function waitTone(ms: number): string {
  const min = ms / 60_000;
  if (min < 5) return "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300";
  if (min < 15) return "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300";
  return "bg-rose-500/12 text-rose-700 ring-rose-500/25 dark:text-rose-300";
}

export function QuickContact({
  lead,
  senderFirstName,
  compact = false,
  onCall,
}: {
  lead: Lead;
  senderFirstName?: string | null;
  compact?: boolean;
  /** Fired when the salesperson taps "Chiama" (opens the outcome dialog after the call) */
  onCall?: () => void;
}) {
  const tel = telHref(lead);
  const wa = whatsappHref(lead, senderFirstName);
  const base = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    compact ? "size-9" : "h-10 px-3.5 text-sm"
  );
  return (
    <div className="flex items-center gap-1.5">
      {tel && (
        <a
          href={tel}
          onClick={onCall}
          aria-label={`Chiama ${lead.name}`}
          className={cn(base, "bg-primary text-primary-foreground hover:bg-primary/85")}
        >
          <Phone className="size-4" />
          {!compact && "Chiama"}
        </a>
      )}
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp a ${lead.name}`}
          className={cn(base, "bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300")}
        >
          <MessageCircle className="size-4" />
          {!compact && "WhatsApp"}
        </a>
      )}
      {lead.email && (
        <a
          href={`mailto:${lead.email}`}
          aria-label={`Email a ${lead.name}`}
          className={cn(base, "border bg-card text-foreground hover:bg-muted")}
        >
          <Mail className="size-4" />
          {!compact && "Email"}
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date helpers for <input type="datetime-local"> (browser local time)
// ---------------------------------------------------------------------------

export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function at(dayOffset: number, h: number, m = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

function nextWorkingDayAt(h: number): Date {
  let off = 1;
  for (;;) {
    const d = at(off, h);
    if (d.getDay() !== 0 && d.getDay() !== 6) return d;
    off++;
  }
}

function inMinutes(min: number): Date {
  const d = new Date(Date.now() + min * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  // Past 19:00 the call-back moves to the next working morning
  if (d.getHours() >= 19 || d.getDate() !== new Date().getDate()) return nextWorkingDayAt(10);
  return d;
}

export function datePresets(): Array<{ label: string; date: Date }> {
  return [
    { label: "Tra 1 ora", date: inMinutes(60) },
    { label: "Tra 3 ore", date: inMinutes(180) },
    { label: "Domani 10:00", date: nextWorkingDayAt(10) },
    { label: "Domani 15:00", date: nextWorkingDayAt(15) },
    { label: "Tra 3 giorni", date: (() => { const d = at(3, 10); if (d.getDay() === 6) d.setDate(d.getDate() + 2); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return d; })() },
  ];
}

export function defaultNextAction(outcome: string): Date | null {
  if (outcome === "non_risponde") return inMinutes(120);
  if (outcome === "richiamare") return nextWorkingDayAt(10);
  if (outcome === "proposta") {
    const d = at(3, 10);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d;
  }
  return null;
}

const dueFmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const timeFmt = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

/** "Scaduto da 2 h", "Oggi 15:30", "gio 6 nov, 10:00" */
export function dueText(iso: string, nowMs: number): { text: string; overdue: boolean; today: boolean } {
  const ms = Date.parse(iso);
  const romeDay = (x: number) => new Date(x).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
  const today = romeDay(ms) === romeDay(nowMs);
  if (ms <= nowMs) return { text: `Scaduto da ${shortDuration(nowMs - ms)}`, overdue: true, today };
  if (today) return { text: `Oggi ${timeFmt.format(ms)}`, overdue: false, today };
  return { text: dueFmt.format(ms), overdue: false, today };
}
