// Lead section: a small call-centre workflow for paid-campaign leads.
// Statuses are the kanban columns; outcomes are what the salesperson records after a call.

export const LEAD_STATUSES = [
  "nuovo",
  "da_richiamare",
  "appuntamento",
  "proposta",
  "vinto",
  "perso",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; open: boolean }> = {
  nuovo: { label: "Nuovo", color: "#0ea5e9", open: true },
  da_richiamare: { label: "Da richiamare", color: "#f59e0b", open: true },
  appuntamento: { label: "Appuntamento", color: "#8b5cf6", open: true },
  proposta: { label: "Proposta inviata", color: "#6366f1", open: true },
  vinto: { label: "Vinto", color: "#10b981", open: false },
  perso: { label: "Perso", color: "#94a3b8", open: false },
};

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}

/** What happened on a call. Each outcome moves the lead to a status. */
export const CALL_OUTCOMES = [
  "non_risponde",
  "richiamare",
  "appuntamento",
  "proposta",
  "non_interessato",
  "non_valido",
  "vinto",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const OUTCOME_CONFIG: Record<
  CallOutcome,
  { label: string; status: LeadStatus; needsDate?: boolean; needsReason?: boolean; needsValue?: boolean; countsAsAnswered: boolean }
> = {
  non_risponde: { label: "Non risponde", status: "da_richiamare", needsDate: true, countsAsAnswered: false },
  richiamare: { label: "Da richiamare", status: "da_richiamare", needsDate: true, countsAsAnswered: true },
  appuntamento: { label: "Appuntamento fissato", status: "appuntamento", needsDate: true, countsAsAnswered: true },
  proposta: { label: "Proposta inviata", status: "proposta", needsDate: true, countsAsAnswered: true },
  non_interessato: { label: "Non interessato", status: "perso", needsReason: true, countsAsAnswered: true },
  non_valido: { label: "Contatto non valido", status: "perso", countsAsAnswered: false },
  vinto: { label: "Chiuso: cliente!", status: "vinto", needsValue: true, countsAsAnswered: true },
};

export function isCallOutcome(v: unknown): v is CallOutcome {
  return typeof v === "string" && (CALL_OUTCOMES as readonly string[]).includes(v);
}

export const LOST_REASONS = [
  "Prezzo / budget",
  "Non è il momento",
  "Ha già un fornitore",
  "Cercava altro",
  "Non ha compilato lui",
  "Altro",
];

export const LEAD_SOURCES = ["meta_form", "landing", "manuale"] as const;
export type LeadSourceKind = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  meta_form: "Modulo Meta",
  landing: "Landing sarconx.com",
  manuale: "Inserito a mano",
};

export interface Lead {
  id: string;
  externalId: string;
  name: string;
  phone: string | null;
  phoneE164: string | null;
  email: string | null;
  company: string | null;
  service: string | null;
  /** JSON: form answers + source context ({ source: {form, campaign, …}, "domanda": "risposta" }) */
  formData: string | null;
  source: string;
  campaign: string | null;
  adset: string | null;
  ad: string | null;
  formName: string | null;
  platform: string | null;
  status: LeadStatus;
  lostReason: string | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
  assignedTo: string | null;
  firstContactAt: string | null;
  lastContactAt: string | null;
  callAttempts: number;
  notes: string | null;
  /** cents */
  value: number | null;
  contactId: string | null;
  dealId: string | null;
  escalatedAt: string | null;
  remindedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LeadEventType = "created" | "call" | "status" | "note" | "converted" | "edit";

export interface LeadEvent {
  id: string;
  leadId: string;
  type: LeadEventType;
  outcome: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
}

/** Parsed formData for display: campaign context + the lead's own answers */
export function splitFormData(raw: string | null): { context: Record<string, string>; answers: Array<[string, string]> } {
  if (!raw) return { context: {}, answers: [] };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const context: Record<string, string> = {};
    if (o.source && typeof o.source === "object") {
      for (const [k, v] of Object.entries(o.source as Record<string, unknown>)) context[k] = String(v);
    }
    const answers: Array<[string, string]> = [];
    for (const [k, v] of Object.entries(o)) {
      if (k === "source") continue;
      answers.push([humanizeKey(k), typeof v === "string" ? v : JSON.stringify(v)]);
    }
    return { context, answers };
  } catch {
    return { context: {}, answers: [] };
  }
}

/** Meta question keys arrive as "quale_servizio_ti_interessa?" → "Quale servizio ti interessa?" */
export function humanizeKey(k: string): string {
  const s = k.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
