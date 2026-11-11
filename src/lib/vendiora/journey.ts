// Vendiora customer journey: one stage per lead/client + a merged timeline
// (lead events, bot chat, offers, contract, payment, calls, automatic messages).
import { getLead, listLeadEvents, listLeads, leadInScope } from "@/lib/db/leads";
import type { Lead } from "@/lib/leads/types";
import {
  findClientByLead, getClient, getConversationByLead, listCalls, listClients, listConversations, listMessages, listOffers,
} from "@/lib/vendiora/db";
import { AUTO_INFO, eur, type AutoKey, type Conversation, type VdClient, type VdOffer } from "@/lib/vendiora/types";

export const STAGES = [
  { key: "nuovo", label: "Nuovo lead", hint: "Appena arrivato" },
  { key: "bot", label: "In chat col bot", hint: "Sta rispondendo alle domande" },
  { key: "qualificato", label: "Da chiamare", hint: "Ha risposto, tocca al commerciale" },
  { key: "offerta", label: "Offerta inviata", hint: "In attesa di risposta" },
  { key: "accettata", label: "Offerta accettata", hint: "Prepara il contratto" },
  { key: "onboarding", label: "Onboarding", hint: "Contratto, pagamento, call di avvio" },
  { key: "costruzione", label: "Store in costruzione", hint: "Corrono i giorni della garanzia" },
  { key: "affiancamento", label: "Affiancamento", hint: "Store online, call" },
  { key: "concluso", label: "Concluso", hint: "Percorso finito" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"] | "perso";

export interface JourneyCard {
  stage: StageKey;
  leadId: string | null;
  clientId: string | null;
  name: string;
  detail: string;
  since: string;
  href: string;
}

function stageOf(lead: Lead | null, conv: Conversation | null, offers: VdOffer[], client: VdClient | null): StageKey {
  if (client) return client.status === "sospeso" ? "perso" : client.status;
  if (offers.some((o) => o.status === "accettata")) return "accettata";
  if (offers.some((o) => o.status === "inviata" || o.status === "vista")) return "offerta";
  if (lead?.status === "perso") return "perso";
  if (conv && (conv.state === "attivo" || conv.state === "in_attesa")) return "bot";
  if (conv || (lead && lead.status !== "nuovo")) return "qualificato";
  return "nuovo";
}

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "oggi" : d === 1 ? "ieri" : `${d} g fa`;
};

/** Board: every Vendiora lead and client in its current stage (last 120 days of leads) */
export async function journeyBoard(): Promise<{ stages: typeof STAGES; cards: JourneyCard[]; lost: number }> {
  const [leads, convs, offers, clients] = await Promise.all([listLeads({ max: 3000 }), listConversations(), listOffers(), listClients()]);
  const since = Date.now() - 120 * 86_400_000;
  const convBy = new Map(convs.map((c) => [c.leadId, c]));
  const offersBy = new Map<string, VdOffer[]>();
  for (const o of offers) if (o.leadId) offersBy.set(o.leadId, [...(offersBy.get(o.leadId) ?? []), o]);
  const clientBy = new Map(clients.filter((c) => c.leadId).map((c) => [c.leadId!, c]));
  const cards: JourneyCard[] = [];
  let lost = 0;
  for (const l of leads) {
    if (!leadInScope(l)) continue;
    const client = clientBy.get(l.id) ?? null;
    if (!client && Date.parse(l.createdAt) < since) continue;
    const lo = offersBy.get(l.id) ?? [];
    const stage = stageOf(l, convBy.get(l.id) ?? null, lo, client);
    if (stage === "perso") { lost++; continue; }
    const offer = lo[0];
    cards.push({
      stage, leadId: l.id, clientId: client?.id ?? null, name: client?.name ?? l.name,
      detail: client ? `${client.packageName} · ${eur(client.price)}` : offer ? `${offer.packageName} · ${eur(offer.price)}` : l.service || l.campaign || l.source,
      since: ago(client?.contractDate ?? offer?.sentAt ?? l.lastContactAt ?? l.createdAt),
      href: client ? `/vendiora/clienti/${client.id}` : `/leads/${l.id}`,
    });
  }
  // Clients sold without a lead
  for (const c of clients) {
    if (c.leadId || c.status === "sospeso") continue;
    cards.push({ stage: c.status, leadId: null, clientId: c.id, name: c.name, detail: `${c.packageName} · ${eur(c.price)}`, since: ago(c.contractDate), href: `/vendiora/clienti/${c.id}` });
  }
  return { stages: STAGES, cards, lost };
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
      if (c.status === "fatta" && (c.doneAt || c.scheduledAt)) items.push({ at: (c.doneAt || c.scheduledAt)!, kind: "call", title: `${c.title} fatta` });
      else if (c.status === "prenotata" && c.scheduledAt) items.push({ at: c.scheduledAt, kind: "call", title: `${c.title} prenotata`, detail: Date.parse(c.scheduledAt) > Date.now() ? "in programma" : undefined });
    }
  }
  items.sort((a, b) => b.at.localeCompare(a.at));
  const stage = stageOf(lead, conv, offers, client);
  return { stage, items };
}
