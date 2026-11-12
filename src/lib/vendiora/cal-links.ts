import type { VendioraSettings } from "@/lib/vendiora/types";

// Cal.com booking links personalised per person: name/email/phone prefilled and a CRM reference in the
// booking metadata (metadata[crm] = "l:<leadId>" | "c:<clientId>"), so the Cal.com webhook knows
// exactly which lead or client (and which call) a booking belongs to. Non-Cal.com links are untouched.

export interface CalWho { name?: string | null; email?: string | null; phone?: string | null; ref?: string | null }

export function isCalUrl(s: Pick<VendioraSettings, "playbook">, url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    const own = s.playbook.cal?.host?.toLowerCase();
    return /(^|\.)cal\.(com|eu)$/.test(h) || (!!own && h === own);
  } catch {
    return false;
  }
}

export function calLink(s: Pick<VendioraSettings, "playbook">, url: string, who?: CalWho): string {
  if (!url || !who || !isCalUrl(s, url)) return url;
  try {
    const u = new URL(url);
    const set = (k: string, v?: string | null) => { if (v && !u.searchParams.has(k)) u.searchParams.set(k, v); };
    set("name", who.name?.trim());
    set("email", who.email?.trim());
    set("attendeePhoneNumber", who.phone?.trim());
    set("metadata[crm]", who.ref);
    return u.toString();
  } catch {
    return url;
  }
}

/** "l:<id>" / "c:<id>" / "c:<id>:<n>" → parts */
export function parseCalRef(v: unknown): { kind: "lead" | "client"; id: string; n: number | null } | null {
  if (typeof v !== "string") return null;
  const m = /^([lc]):([A-Za-z0-9_-]{6,40})(?::(\d{1,2}))?$/.exec(v.trim());
  if (!m) return null;
  return { kind: m[1] === "l" ? "lead" : "client", id: m[2], n: m[3] ? Number(m[3]) : null };
}
