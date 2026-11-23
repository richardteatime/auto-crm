import { createLead, updateLead, addLeadEvent, findLeadsByPhone, type NewLead } from "@/lib/db/leads";
import { vendioraEnabled } from "@/lib/roles";
import { createContact, createDeal, getStages } from "@/lib/db";
import { normalizePhone, type NormalizedLead } from "@/lib/leads/intake";
import { notifyNewLead, sendLeadAck } from "@/lib/leads/notify";
import { CRM_INSTANCE_ID, crmLabel } from "@/lib/instance";
import {
  OUTCOME_CONFIG,
  LEAD_STATUS_CONFIG,
  LEAD_SOURCE_LABELS,
  LEAD_LINE_LABELS,
  detectLeadLine,
  isLeadLine,
  type LeadLine,
  type CallOutcome,
  type Lead,
  type LeadStatus,
} from "@/lib/leads/types";

export interface Actor {
  id: string | null;
  name: string;
}

const SYSTEM: Actor = { id: null, name: "Sistema" };

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

/**
 * Who calls a lead of each line. Env LEAD_ROUTING="sito=<userId>,ecommerce=<userId>,altro=<userId>"
 * ("altro" = line not recognised). Missing entry = unassigned (everyone sees it anyway).
 */
export function routeLead(line: LeadLine | null): string | null {
  const map = Object.fromEntries(
    (process.env.LEAD_ROUTING || "").split(",").map((x) => x.split("=").map((s) => s.trim())).filter((x) => x.length === 2 && x[0] && x[1])
  ) as Record<string, string>;
  return map[line ?? "altro"] ?? null;
}

/** Explicit line from the source wins; else guessed from service, answers, campaign and form names */
export function lineOf(n: NormalizedLead): LeadLine | null {
  if (isLeadLine(n.line)) return n.line;
  const answers = Object.entries(n.formData).filter(([k]) => k !== "source").map(([k, v]) => `${k} ${typeof v === "string" ? v : ""}`);
  return detectLeadLine([n.service, n.context.campaign, n.context.adset, n.context.ad, n.context.form, ...answers]);
}

export async function ingestLead(
  n: NormalizedLead,
  source: string,
  opts: { notify?: boolean; actor?: Actor } = {}
): Promise<{ lead: Lead; duplicate: boolean }> {
  const phoneE164 = normalizePhone(n.phone);
  const line = lineOf(n);
  const data: NewLead = {
    line,
    assignedTo: routeLead(line),
    externalId: n.externalId,
    name: n.name?.trim() || n.email || n.phone || "Senza nome",
    phone: n.phone || null,
    phoneE164,
    email: n.email,
    company: n.company,
    service: n.service,
    formData: Object.keys(n.formData).length ? JSON.stringify(n.formData) : null,
    source,
    campaign: n.context.campaign ?? null,
    adset: n.context.adset ?? null,
    ad: n.context.ad ?? null,
    formName: n.context.form ?? null,
    platform: n.context.platform ?? null,
  };

  const result = await createLead(data);
  if (result.duplicate) return result;

  // Same person already in the list (e.g. filled the form twice): flag it on the timeline
  let dupNote: string | null = null;
  if (phoneE164) {
    const others = (await findLeadsByPhone(phoneE164)).filter((l) => l.id !== result.lead.id);
    if (others.length) {
      dupNote = `Stesso numero di: ${others.map((o) => `${o.name} (${LEAD_STATUS_CONFIG[o.status].label})`).join(", ")}`;
    }
  }

  const actor = opts.actor ?? SYSTEM;
  await addLeadEvent({
    leadId: result.lead.id,
    type: "created",
    outcome: null,
    fromStatus: null,
    toStatus: "nuovo",
    note: [LEAD_SOURCE_LABELS[source] ?? source, line && LEAD_LINE_LABELS[line], n.context.campaign && `campagna «${n.context.campaign}»`, dupNote]
      .filter(Boolean)
      .join(" · "),
    actorId: actor.id,
    actorName: actor.name,
  });

  if (opts.notify !== false) {
    await notifyNewLead(result.lead).catch((e) => console.error("[lead notify]", e));
    // "We got your request" by email (sito leads; switch LEAD_ACK_SITO=1)
    await sendLeadAck(result.lead).catch((e) => console.error("[lead ack]", e));
  }
  if (opts.notify !== false && line !== "sito") {
    // Vendiora: WhatsApp bot / playbook contacts the lead right away (no-op when off).
    // Website leads are SarconX's (Matteo): VendiOra never writes to them.
    // (fire and forget: the intake answers immediately, the server process keeps running)
    if (vendioraEnabled()) void import("@/lib/vendiora/bot").then(({ onNewLead }) => onNewLead(result.lead));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Call outcome
// ---------------------------------------------------------------------------

export interface OutcomeInput {
  outcome: CallOutcome;
  note?: string | null;
  nextActionAt?: string | null;
  lostReason?: string | null;
  /** cents */
  value?: number | null;
}

export async function recordOutcome(lead: Lead, input: OutcomeInput, actor: Actor): Promise<Lead> {
  const cfg = OUTCOME_CONFIG[input.outcome];
  const now = new Date().toISOString();
  const patch: Partial<Lead> = {
    status: cfg.status,
    lastContactAt: now,
    callAttempts: (lead.callAttempts ?? 0) + 1,
    firstContactAt: lead.firstContactAt ?? now,
    nextActionAt: cfg.needsDate ? input.nextActionAt ?? null : null,
    nextActionNote: cfg.needsDate ? (input.outcome === "appuntamento" ? "Appuntamento" : cfg.label) : null,
    remindedAt: null,
    assignedTo: lead.assignedTo || actor.id,
  };
  if (cfg.status === "perso") patch.lostReason = input.lostReason || cfg.label;
  if (cfg.status !== "perso") patch.lostReason = null;
  if (cfg.needsValue && input.value != null) patch.value = input.value;

  const updated = await updateLead(lead.id, patch);
  await addLeadEvent({
    leadId: lead.id,
    type: "call",
    outcome: input.outcome,
    fromStatus: lead.status,
    toStatus: cfg.status,
    note: [
      input.note?.trim(),
      cfg.status === "perso" && patch.lostReason !== cfg.label ? `Motivo: ${patch.lostReason}` : null,
    ]
      .filter(Boolean)
      .join("\n") || null,
    actorId: actor.id,
    actorName: actor.name,
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Status change (kanban drag, menu)
// ---------------------------------------------------------------------------

export async function changeStatus(lead: Lead, status: LeadStatus, actor: Actor, extra: Partial<Lead> = {}): Promise<Lead> {
  if (lead.status === status && Object.keys(extra).length === 0) return lead;
  const patch: Partial<Lead> = { status, ...extra };
  if (!LEAD_STATUS_CONFIG[status].open) {
    patch.nextActionAt = null;
    patch.nextActionNote = null;
  }
  if (status !== "perso") patch.lostReason = null;
  const updated = await updateLead(lead.id, patch);
  if (lead.status !== status) {
    await addLeadEvent({
      leadId: lead.id,
      type: "status",
      outcome: null,
      fromStatus: lead.status,
      toStatus: status,
      note: status === "perso" && extra.lostReason ? `Motivo: ${extra.lostReason}` : null,
      actorId: actor.id,
      actorName: actor.name,
    });
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Lead → contact + deal in the main CRM (founders only)
// ---------------------------------------------------------------------------

export async function convertLead(lead: Lead, actor: Actor, opts: { value?: number | null; title?: string | null } = {}) {
  if (lead.dealId) return { lead, contactId: lead.contactId, dealId: lead.dealId, already: true };

  const contactSource = lead.source === "landing" ? "website" : lead.source === "meta_form" ? "redes_sociales" : "otro";
  const contactId =
    lead.contactId ||
    (
      await createContact({
        name: lead.name,
        email: lead.email,
        phone: lead.phoneE164 || lead.phone,
        company: lead.company,
        source: contactSource,
        temperature: "hot",
        notes: [lead.service && `Interesse: ${lead.service}`, lead.campaign && `Campagna: ${lead.campaign}`, lead.notes]
          .filter(Boolean)
          .join("\n") || null,
      })
    ).id;

  const stages = (await getStages()).sort((a, b) => a.order - b.order);
  const stage = lead.status === "vinto" ? stages.find((s) => s.isWon) : stages.find((s) => !s.isWon && !s.isLost);
  const value = opts.value ?? lead.value ?? 0;
  const deal = await createDeal({
    title: opts.title?.trim() || `${lead.company || lead.name}${lead.service ? ` · ${lead.service}` : ""}`,
    value,
    contactId,
    stageId: stage?.id,
    notes: `Dal lead del ${new Date(lead.createdAt).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}`,
  });

  const updated = await updateLead(lead.id, {
    contactId,
    dealId: deal.id,
    value: value || lead.value,
    ...(CRM_INSTANCE_ID ? { dealCrm: CRM_INSTANCE_ID } : {}),
  });
  await addLeadEvent({
    leadId: lead.id,
    type: "converted",
    outcome: null,
    fromStatus: null,
    toStatus: null,
    note: `Creata la trattativa «${deal.title}»${CRM_INSTANCE_ID ? ` nel ${crmLabel(CRM_INSTANCE_ID)}` : ""}`,
    actorId: actor.id,
    actorName: actor.name,
  });
  return { lead: updated, contactId, dealId: deal.id, already: false };
}
