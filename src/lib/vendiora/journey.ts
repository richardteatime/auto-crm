// Vendiora customer journey: one stage per lead/client + a merged timeline
// (lead events, bot chat, offers, contract, payment, calls, automatic messages).
import { getLead, listLeadEvents, listLeads, leadInScope } from "@/lib/db/leads";
import type { Lead } from "@/lib/leads/types";
import {
  findClientByLead, getClient, getConversationByLead, listCalls, listClients, listConversations, listMessages, listOffers,
} from "@/lib/vendiora/db";
import { AUTO_INFO, eur, type AutoKey, type Conversation, type VdClient, type VdOffer } from "@/lib/vendiora/types";
import { CONSULENZA_STAGES, DFY_STAGES, SALES_STAGES, UPSELL_STAGES, lineOf, playbookPackage, stageLabel } from "@/lib/vendiora/playbook";

export type Pipeline = "vendite" | "consulenza" | "dfy" | "upsell";
export const PIPELINES: { id: Pipeline; label: string; hint: string; stages: { id: string; label: string; hint?: string }[] }[] = [
  { id: "vendite", label: "Vendite (S)", hint: "Dal lead alla firma", stages: SALES_STAGES.map((s) => ({ id: s.id, label: `${s.id.startsWith("S") ? s.id + " · " : ""}${s.label}` })) },
  { id: "consulenza", label: "Consulenza (O1–O7)", hint: "Base ed Elite", stages: [...CONSULENZA_STAGES.map((s) => ({ id: s.id, label: `${s.id} · ${s.label}`, hint: s.exit })), { id: "SOSP", label: "Sospeso" }, { id: "RIMB", label: "Rimborsato" }] },
  { id: "dfy", label: "Done For You (D1–D8)", hint: "Store, Store + Ads, Full", stages: [...DFY_STAGES.map((s) => ({ id: s.id, label: `${s.id} · ${s.label}`, hint: s.exit })), { id: "SOSP", label: "Sospeso" }, { id: "RIMB", label: "Rimborsato" }] },
  { id: "upsell", label: "Upsell (U1–U6)", hint: "Dal segnale a metà percorso al nuovo pacchetto", stages: UPSELL_STAGES.map((s) => ({ id: s.id, label: `${s.id} · ${s.label}`, hint: s.hint })) },
];
/** Old flat list kept for the timeline badge */
export const STAGES = PIPELINES.flatMap((p) => p.stages.map((s) => ({ key: s.id, label: s.label, hint: s.hint ?? "" })));
export type StageKey = string;

export interface JourneyCard {
  stage: StageKey;
  leadId: string | null;
  clientId: string | null;
  name: string;
  detail: string;
  since: string;
  href: string;
  health?: "verde" | "giallo" | "rosso" | null;
  badges?: string[];
}

/** Sales stage S1–S7 / PERSO / NURT */
function salesStage(lead: Lead | null, conv: Conversation | null, offers: VdOffer[], client: VdClient | null): StageKey {
  if (client || offers.some((o) => o.paidAt || o.status === "accettata")) return "S7";
  if (lead?.status === "vinto") return "S7";
  if (lead?.status === "perso" || offers.some((o) => o.status === "scaduta" && o.autoLog?.["M3.lost"])) return "PERSO";
  if (offers.some((o) => o.status === "inviata" || o.status === "vista")) return "S6";
  if (conv?.seqLog?.noShowAt && lead?.status !== "appuntamento") return "S4b";
  if (lead?.status === "proposta") return "S5";
  if (lead?.status === "appuntamento") return "S4";
  if (conv?.qual === "nurturing") return "NURT";
  if (conv?.qual === "qualificato") return "S3";
  if (conv && (conv.state === "attivo" || conv.state === "in_attesa" || conv.state === "programmato")) return "S2";
  if (lead && lead.status !== "nuovo") return "S3";
  return "S1";
}

function clientStage(client: VdClient): StageKey {
  if (client.status === "sospeso") return "SOSP";
  if (client.status === "rimborsato") return "RIMB";
  if (client.stage) return client.stage;
  return lineOf(client.packageCode) === "dfy" ? "D1" : "O1";
}

function stageOf(lead: Lead | null, conv: Conversation | null, offers: VdOffer[], client: VdClient | null): StageKey {
  return client ? clientStage(client) : salesStage(lead, conv, offers, client);
}

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "oggi" : d === 1 ? "ieri" : `${d} g fa`;
};

/** Board of one pipeline (leads of the last 120 days for Vendite) */
export async function journeyBoard(pipeline: Pipeline = "vendite"): Promise<{ pipelines: typeof PIPELINES; pipeline: Pipeline; stages: { id: string; label: string; hint?: string }[]; cards: JourneyCard[]; lost: number; counts: Record<Pipeline, number> }> {
  const [leads, convs, offers, clients] = await Promise.all([listLeads({ max: 3000 }), listConversations(), listOffers(), listClients()]);
  const since = Date.now() - 120 * 86_400_000;
  const convBy = new Map(convs.map((c) => [c.leadId, c]));
  const offersBy = new Map<string, VdOffer[]>();
  for (const o of offers) if (o.leadId) offersBy.set(o.leadId, [...(offersBy.get(o.leadId) ?? []), o]);
  const clientBy = new Map(clients.filter((c) => c.leadId).map((c) => [c.leadId!, c]));
  const sales: JourneyCard[] = [];
  let lost = 0;
  for (const l of leads) {
    if (!leadInScope(l)) continue;
    const client = clientBy.get(l.id) ?? null;
    if (Date.parse(l.createdAt) < since && !client) continue;
    const lo = offersBy.get(l.id) ?? [];
    const conv = convBy.get(l.id) ?? null;
    const stage = salesStage(l, conv, lo, client);
    if (stage === "PERSO") lost++;
    const offer = lo[0];
    const badges = [conv?.angle, conv?.score != null ? `${conv.score}/100` : null, conv?.pkg ? `→ ${playbookPackage(conv.pkg)?.name ?? conv.pkg}` : null].filter((x): x is string => !!x);
    sales.push({
      stage, leadId: l.id, clientId: client?.id ?? null, name: client?.name ?? l.name,
      detail: client ? `${client.packageName} · ${eur(client.price)}` : offer ? `${offer.packageName} · ${eur(offer.price)}${offer.signedAt ? " · firmata" : ""}` : l.service || l.campaign || l.source,
      since: ago(client?.contractDate ?? offer?.sentAt ?? l.lastContactAt ?? l.createdAt),
      href: client ? `/vendiora/clienti/${client.id}` : `/leads/${l.id}`, badges,
    });
  }
  const del = (line: "consulenza" | "dfy") => clients
    .filter((c) => (lineOf(c.packageCode) ?? "consulenza") === line)
    .map((c) => ({
      stage: clientStage(c), leadId: c.leadId, clientId: c.id, name: c.name, detail: `${c.packageName} · ${eur(c.price)}`,
      since: ago(c.ops.activatedAt ?? c.contractDate), href: `/vendiora/clienti/${c.id}`, health: c.health,
      badges: [c.coach ? `coach ${c.coach}` : "senza coach", c.ops.paymentStatus === "a_rischio" ? "rata a rischio" : null].filter((x): x is string => !!x),
    }));
  const up = clients.filter((c) => c.ops.upsell?.stage).map((c) => ({
    stage: c.ops.upsell!.stage, leadId: c.leadId, clientId: c.id, name: c.name,
    detail: `${c.packageName}${c.ops.upsell?.suggested ? ` → ${c.ops.upsell.suggested}` : ""}`, since: ago(c.ops.upsell!.at), href: `/vendiora/clienti/${c.id}`, health: c.health,
    badges: [c.ops.upsell?.readiness ? `pronto: ${c.ops.upsell.readiness}` : null].filter((x): x is string => !!x),
  }));
  const all: Record<Pipeline, JourneyCard[]> = { vendite: sales, consulenza: del("consulenza"), dfy: del("dfy"), upsell: up };
  const def = PIPELINES.find((p) => p.id === pipeline) ?? PIPELINES[0];
  return {
    pipelines: PIPELINES, pipeline: def.id, stages: def.stages, cards: all[def.id], lost,
    counts: { vendite: sales.length, consulenza: all.consulenza.length, dfy: all.dfy.length, upsell: up.length },
  };
}

export interface TimelineItem { at: string; kind: "lead" | "bot" | "offer" | "contract" | "pay" | "call" | "auto" | "store" | "note"; title: string; detail?: string }

const AUTO_TITLE = (k: string) => `WhatsApp automatico · ${AUTO_INFO[k as AutoKey]?.label ?? k}`;

/** Full timeline for one lead and/or client, newest first */
export async function journeyTimeline(ref: { leadId?: string | null; clientId?: string | null }) {
  const client = ref.clientId ? await getClient(ref.clientId) : ref.leadId ? await findClientByLead(ref.leadId) : null;
  const leadId = ref.leadId ?? client?.leadId ?? null;
  const [lead, events, conv, offers, calls, msgs] = await Promise.all([
    leadId ? getLead(leadId) : null,
    leadId ? listLeadEvents(leadId) : [],
    leadId ? getConversationByLead(leadId) : null,
    leadId ? listOffers({ leadId }) : [],
    client ? listCalls({ clientId: client.id }) : [],
    leadId ? listMessages({ leadId }) : client?.phoneE164 ? listMessages({ phoneE164: client.phoneE164 }) : [],
  ]);
  const items: TimelineItem[] = [];
  if (lead) items.push({ at: lead.createdAt, kind: "lead", title: "Lead arrivato", detail: [lead.campaign, lead.formName].filter(Boolean).join(" · ") || lead.source });
  for (const e of events) {
    if (e.type === "created") continue;
    if (e.note?.startsWith("WhatsApp automatico")) continue; // shown from the messages below
    const title = e.type === "call" ? `Chiamata${e.outcome ? ` · ${e.outcome}` : ""}` : e.type === "status" ? `Stato: ${e.toStatus ?? ""}` : e.type === "converted" ? "Passato in Finance" : "Nota";
    items.push({ at: e.createdAt, kind: e.type === "call" ? "call" : "note", title, detail: [e.note, e.actorName].filter(Boolean).join(" — ") || undefined });
  }
  const firstBot = msgs.filter((m) => m.author === "bot").sort((a, b) => a.at.localeCompare(b.at))[0];
  if (firstBot) items.push({ at: firstBot.at, kind: "bot", title: "Il bot ha scritto su WhatsApp" });
  if (conv?.handoffAt) items.push({ at: conv.handoffAt, kind: "bot", title: "Chat passata al commerciale", detail: conv.answers.length ? `${conv.answers.length} risposte raccolte` : undefined });
  for (const m of msgs) if (m.author === "automatico") items.push({ at: m.at, kind: "auto", title: "WhatsApp automatico", detail: m.text.length > 140 ? m.text.slice(0, 140) + "…" : m.text });
  for (const o of offers) {
    items.push({ at: o.createdAt, kind: "offer", title: `Offerta ${o.number} preparata`, detail: `${o.packageName} · ${eur(o.price)} + IVA` });
    if (o.sentAt) items.push({ at: o.sentAt, kind: "offer", title: `Offerta ${o.number} inviata` });
    if (o.viewedAt) items.push({ at: o.viewedAt, kind: "offer", title: `Offerta ${o.number} aperta dal lead` });
    if (o.signedAt) items.push({ at: o.signedAt, kind: "contract", title: `Offerta ${o.number} firmata da ${o.signName ?? o.name}`, detail: o.signIp ? `IP ${o.signIp}` : undefined });
    if (o.paidAt) items.push({ at: o.paidAt, kind: "pay", title: `Pagamento dell'offerta ${o.number} ricevuto` });
    if (o.answeredAt) items.push({ at: o.answeredAt, kind: "offer", title: `Offerta ${o.number} ${o.status === "rifiutata" ? "rifiutata" : "accettata"}` });
  }
  if (client) {
    items.push({ at: client.contractDate, kind: "contract", title: `Venduto · contratto ${client.contractNumber}`, detail: `${client.packageName} · ${eur(client.price)} + IVA` });
    if (client.contractSignedAt) items.push({ at: client.contractSignedAt, kind: "contract", title: "Contratto firmato" });
    if (client.paidAt) items.push({ at: client.paidAt, kind: "pay", title: "Pagamento ricevuto" });
    if (client.kickoffAt) items.push({ at: client.kickoffAt, kind: "store", title: "Call di avvio: store in costruzione" });
    if (client.storeLiveAt) items.push({ at: client.storeLiveAt, kind: "store", title: "Store online", detail: client.storeUrl || undefined });
    const hasAutoMsgs = msgs.some((m) => m.author === "automatico");
    if (!hasAutoMsgs) for (const [k, at] of Object.entries(client.autoLog)) if (at) items.push({ at, kind: "auto", title: AUTO_TITLE(k) });
    for (const c of calls) {
      if (c.status === "fatta" && (c.doneAt || c.scheduledAt)) items.push({ at: (c.doneAt || c.scheduledAt)!, kind: "call", title: `${c.title} fatta`, detail: c.summary ? c.summary.slice(0, 200) + (c.summary.length > 200 ? "…" : "") : undefined });
      else if (c.status === "prenotata" && c.scheduledAt) items.push({ at: c.scheduledAt, kind: "call", title: `${c.title} prenotata`, detail: Date.parse(c.scheduledAt) > Date.now() ? "in programma" : undefined });
    }
  }
  if (client?.ops.activatedAt) items.push({ at: client.ops.activatedAt, kind: "contract", title: "Percorso attivato: call create col calendario del pacchetto" });
  for (const ci of client?.ops.checkins ?? []) items.push({ at: ci.at, kind: "note", title: "Check-in del venerdì", detail: ci.answers.join(" · ").slice(0, 200) });
  if (client?.ops.npsAt) items.push({ at: client.ops.npsAt, kind: "note", title: `NPS: ${client.ops.nps}/10` });
  items.sort((a, b) => b.at.localeCompare(a.at));
  const stage = stageOf(lead, conv, offers, client);
  return { stage, stageLabel: stageLabel(stage), items };
}
