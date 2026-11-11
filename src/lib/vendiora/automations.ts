// Vendiora automatic WhatsApp messages: offer link, offer follow-up, welcome, call reminders,
// store online, end of coaching. Texts and on/off live in Vendiora settings ("Messaggi automatici").
// Every sender is idempotent (client.autoLog / call.reminderAt / offer.followupAt) and never throws.
import { addLeadEvent, updateLead } from "@/lib/db/leads";
import { APP_URL } from "@/lib/leads/notify";
import {
  addMessage, getSettings, listCalls, listClients, listOffers, updateCall, updateClient, updateOffer, getConversationByLead, saveConversation,
} from "@/lib/vendiora/db";
import { waConfigured, waSend } from "@/lib/vendiora/wa";
import {
  eur, fillTemplate, type AutoKey, type VdCall, type VdClient, type VdOffer, type VdPackage, type VendioraSettings,
} from "@/lib/vendiora/types";

const firstName = (name: string) => (name || "").trim().split(/\s+/)[0] || "";
const TZ = "Europe/Rome";
export const dateIt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }) : "";
const dateShort = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }) : "";
const timeIt = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "");

export const offerUrl = (o: Pick<VdOffer, "token">) => `${APP_URL}/offerta/${o.token}`;

/** Drops lines whose only content was an empty placeholder (e.g. "👉 " when no booking link is set) */
function render(t: string, v: Record<string, string>) {
  const out = fillTemplate(t, v);
  return out
    .split("\n")
    .filter((l) => !/^\s*[^\p{L}\p{N}]*👉\s*$/u.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function baseVars(s: VendioraSettings, name: string) {
  return {
    nome: firstName(name),
    referente: s.bot.handoffName || "il nostro team",
    prenota: s.bot.coachingBookingUrl || s.bot.calendlyUrl || "",
  };
}

export function offerVars(s: VendioraSettings, o: VdOffer) {
  return {
    ...baseVars(s, o.name),
    pacchetto: o.packageName,
    prezzo: eur(o.price),
    link: offerUrl(o),
    scadenza: dateShort(o.validUntil),
  };
}

export function offerText(s: VendioraSettings, o: VdOffer, key: "offer" | "offerFollowup" = "offer") {
  return render(s.automations[key].text, offerVars(s, o));
}

async function deliver(opts: { phoneE164: string; text: string; leadId: string | null; clientId: string | null; note: string }) {
  const r = await waSend(opts.phoneE164, opts.text);
  const at = new Date().toISOString();
  await addMessage({ leadId: opts.leadId, clientId: opts.clientId, phoneE164: opts.phoneE164, direction: "out", author: "automatico", text: opts.text, waId: r.id, at });
  if (opts.leadId) {
    // A person (or the journey) is now talking: the qualifying bot must not jump back in
    const conv = await getConversationByLead(opts.leadId).catch(() => null);
    if (conv && (conv.state === "attivo" || conv.state === "in_attesa")) await saveConversation({ ...conv, state: "passato", handoffAt: conv.handoffAt ?? at });
    await updateLead(opts.leadId, { lastContactAt: at }).catch(() => {});
    await addLeadEvent({
      leadId: opts.leadId, type: "note", outcome: null, fromStatus: null, toStatus: null,
      note: `WhatsApp automatico: ${opts.note}`, actorId: null, actorName: "Vendiora",
    }).catch(() => {});
  }
  return r;
}

export type AutoResult = { sent: boolean; reason?: string };

function canSend(s: VendioraSettings, key: AutoKey, phone: string | null): string | null {
  if (!s.automations[key].enabled) return "messaggio spento";
  if (!waConfigured()) return "WhatsApp non configurato";
  if (!phone) return "manca il numero di telefono";
  return null;
}

// ---------------------------------------------------------------------------
// Offer
// ---------------------------------------------------------------------------

export async function sendOffer(o: VdOffer): Promise<AutoResult> {
  const s = await getSettings();
  if (!waConfigured()) return { sent: false, reason: "WhatsApp non collegato" };
  if (!o.phoneE164) return { sent: false, reason: "Il lead non ha un numero valido" };
  try {
    await deliver({ phoneE164: o.phoneE164, text: offerText(s, o), leadId: o.leadId, clientId: null, note: `offerta ${o.number} inviata` });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "invio fallito" };
  }
}

// ---------------------------------------------------------------------------
// Client journey
// ---------------------------------------------------------------------------

function pkgOf(c: VdClient): Partial<VdPackage> {
  try { return c.packageSnapshot ? (JSON.parse(c.packageSnapshot) as Partial<VdPackage>) : {}; } catch { return {}; }
}

/** Sends a one-off journey message (welcome, storeLive, coachingEnd) once per client */
export async function sendClientAuto(key: "welcome" | "storeLive" | "coachingEnd", client: VdClient, s?: VendioraSettings): Promise<AutoResult> {
  try {
    const settings = s ?? (await getSettings());
    if (client.autoLog[key]) return { sent: false, reason: "già inviato" };
    const why = canSend(settings, key, client.phoneE164);
    if (why) return { sent: false, reason: why };
    const v = { ...baseVars(settings, client.name), pacchetto: client.packageName, contratto: client.contractNumber, store: client.storeUrl || "" };
    const text = render(settings.automations[key].text, v);
    await deliver({ phoneE164: client.phoneE164!, text, leadId: client.leadId, clientId: client.id, note: labelOf(key) });
    await updateClient(client.id, { autoLog: { ...client.autoLog, [key]: new Date().toISOString() } });
    return { sent: true };
  } catch (e) {
    console.error(`[vendiora auto ${key}]`, e instanceof Error ? e.message : e);
    return { sent: false, reason: e instanceof Error ? e.message : "invio fallito" };
  }
}

const LABELS: Record<AutoKey, string> = {
  offer: "offerta", offerFollowup: "promemoria offerta", welcome: "messaggio di benvenuto", callReminder: "promemoria call",
  storeLive: "avviso store online", coachingEnd: "chiusura affiancamento",
};
const labelOf = (k: AutoKey) => LABELS[k];

async function sendCallReminder(s: VendioraSettings, call: VdCall, client: VdClient): Promise<AutoResult> {
  const why = canSend(s, "callReminder", client.phoneE164);
  if (why) return { sent: false, reason: why };
  const v = { ...baseVars(s, client.name), call: call.title.toLowerCase().startsWith("call") ? call.title : `call «${call.title}»`, data: dateIt(call.scheduledAt), ora: timeIt(call.scheduledAt) };
  const text = render(s.automations.callReminder.text, v);
  await deliver({ phoneE164: client.phoneE164!, text, leadId: client.leadId, clientId: client.id, note: `promemoria ${call.title}` });
  await updateCall(call.id, { reminderAt: new Date().toISOString() });
  return { sent: true };
}

/** Periodic run (prod instance only): reminders, follow-ups, expiries, end of coaching */
export async function runVendioraAutomations(now = Date.now()): Promise<Record<string, number>> {
  const out = { reminders: 0, followups: 0, expired: 0, coachingEnd: 0 };
  const s = await getSettings();

  // Offers: expire, then follow up after 48 h without an answer
  for (const o of await listOffers()) {
    if (o.status !== "inviata" && o.status !== "vista") continue;
    if (o.validUntil && Date.parse(o.validUntil) < now) {
      await updateOffer(o.id, { status: "scaduta" }).catch(() => {});
      out.expired++;
      continue;
    }
    if (!o.followupAt && o.sentAt && now - Date.parse(o.sentAt) > 48 * 3_600_000 && !canSend(s, "offerFollowup", o.phoneE164)) {
      try {
        await deliver({ phoneE164: o.phoneE164!, text: offerText(s, o, "offerFollowup"), leadId: o.leadId, clientId: null, note: `promemoria offerta ${o.number}` });
        await updateOffer(o.id, { followupAt: new Date().toISOString() });
        out.followups++;
      } catch (e) { console.error("[vendiora followup]", e instanceof Error ? e.message : e); }
    }
  }

  const clients = await listClients();
  const byId = new Map(clients.map((c) => [c.id, c]));

  // Call reminders: booked calls starting within the next 24 hours
  for (const call of await listCalls()) {
    if (call.status !== "prenotata" || !call.scheduledAt || call.reminderAt) continue;
    const t = Date.parse(call.scheduledAt);
    if (t <= now || t - now > 24 * 3_600_000) continue;
    const client = byId.get(call.clientId);
    if (!client || client.status === "sospeso") continue;
    try { if ((await sendCallReminder(s, call, client)).sent) out.reminders++; } catch (e) { console.error("[vendiora reminder]", e instanceof Error ? e.message : e); }
  }

  // End of coaching: store live + coachingDays
  for (const c of clients) {
    if (c.autoLog.coachingEnd || !c.storeLiveAt || c.status !== "affiancamento") continue;
    const days = pkgOf(c).coachingDays ?? 0;
    if (!days || Date.parse(c.storeLiveAt) + days * 86_400_000 > now) continue;
    if ((await sendClientAuto("coachingEnd", c, s)).sent) out.coachingEnd++;
  }
  return out;
}
