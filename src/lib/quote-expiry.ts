// Quote expiry, shared by the UI (red / amber badges) and the server alerts.
// A quote "counts" until it is paid or rejected: past its validUntil date it
// turns red, QUOTE_WARN_DAYS before it turns amber. Days are Europe/Rome days.
// Keep this file free of server imports: client components use it too.

import { romeDayDiff } from "@/lib/dates";

export const QUOTE_WARN_DAYS = 3;

export type QuoteExpiryState = "paid" | "closed" | "expired" | "soon" | "ok" | "none";

export interface QuoteExpiry {
  state: QuoteExpiryState;
  /** Days until validUntil (negative = days since it expired), null without a date */
  days: number | null;
}

function toMs(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  const ms = new Date(String(v)).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function quoteExpiry(
  q: { status?: string | null; isPaid?: boolean | null; dealIsPaid?: boolean | null; validUntil?: unknown },
  nowMs: number = Date.now()
): QuoteExpiry {
  // Paid on the quote, or the whole deal is marked paid (Finance)
  if (q.isPaid || q.dealIsPaid) return { state: "paid", days: null };
  if (q.status === "rifiutato") return { state: "closed", days: null };
  const ms = toMs(q.validUntil);
  if (ms === null) return { state: "none", days: null };
  const days = romeDayDiff(nowMs, ms);
  if (days < 0) return { state: "expired", days };
  if (days <= QUOTE_WARN_DAYS) return { state: "soon", days };
  return { state: "ok", days };
}

/** Short Italian label for a badge, or null when nothing needs showing */
export function quoteExpiryLabel(e: QuoteExpiry): string | null {
  switch (e.state) {
    case "paid":
      return "Pagato";
    case "expired":
      return e.days === -1 ? "Scaduto ieri" : `Scaduto da ${-(e.days ?? 0)} gg`;
    case "soon":
      return e.days === 0 ? "Scade oggi" : e.days === 1 ? "Scade domani" : `Scade tra ${e.days} gg`;
    default:
      return null;
  }
}
