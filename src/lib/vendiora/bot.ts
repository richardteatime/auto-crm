// Vendiora WhatsApp bot: greets a new lead, asks the qualifying questions one by one,
// then hands the conversation over to a person (push + in-app notification) with the booking link.
import { getLead, updateLead, addLeadEvent, findLeadsByPhone } from "@/lib/db/leads";
import { createNotification } from "@/lib/db/notifications";
import { sendPush, APP_URL } from "@/lib/leads/notify";
import { normalizePhone } from "@/lib/leads/intake";
import type { Lead } from "@/lib/leads/types";
import {
  addMessage, findConversation, getConversationByLead, getSettings, saveConversation,
} from "@/lib/vendiora/db";
import { waConfigured, waSend } from "@/lib/vendiora/wa";
import { fillTemplate, type BotSettings, type Conversation } from "@/lib/vendiora/types";

const firstName = (name: string) => (name || "").trim().split(/\s+/)[0] || "";

function vars(bot: BotSettings, lead: Pick<Lead, "name">) {
  return {
    nome: firstName(lead.name),
    referente: bot.handoffName || "il nostro team",
    link: bot.calendlyUrl || "",
    n: String(bot.questions.length),
  };
}

/** Removes a line that only holds an empty {link} so a missing booking URL doesn't leave "👉 " behind */
function render(t: string, v: Record<string, string>) {
  const out = fillTemplate(t, v);
  return v.link ? out : out.replace(/[^\n]*👉\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

async function sendAndLog(phoneE164: string, text: string, leadId: string | null, author: string) {
  const r = await waSend(phoneE164, text);
  await addMessage({ leadId, clientId: null, phoneE164, direction: "out", author, text, waId: r.id, at: new Date().toISOString() });
  return r;
}

export async function startBotForLead(lead: Lead, opts: { force?: boolean } = {}): Promise<{ started: boolean; reason?: string }> {
  const settings = await getSettings();
  const bot = settings.bot;
  if (!opts.force && !bot.enabled) return { started: false, reason: "bot spento" };
  if (!waConfigured()) return { started: false, reason: "WhatsApp non configurato" };
  if (!lead.phoneE164) return { started: false, reason: "il lead non ha un numero valido" };
  const existing = await getConversationByLead(lead.id);
  if (existing && !opts.force) return { started: false, reason: "già contattato" };

  const v = vars(bot, lead);
  const first = bot.questions[0];
  const text = [render(bot.greeting, v), first].filter(Boolean).join("\n\n");
  const r = await sendAndLog(lead.phoneE164, text, lead.id, "bot");
  await saveConversation({
    id: existing?.id,
    leadId: lead.id,
    phoneE164: lead.phoneE164,
    chatIds: [r.chatId, r.lid].filter((x): x is string => !!x),
    state: first ? "in_attesa" : "passato",
    step: 0,
    answers: [],
    lastInboundAt: existing?.lastInboundAt ?? null,
    handoffAt: first ? null : new Date().toISOString(),
  });
  const now = new Date().toISOString();
  await updateLead(lead.id, {
    firstContactAt: lead.firstContactAt ?? now,
    lastContactAt: now,
  });
  await addLeadEvent({
    leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null,
    note: "WhatsApp: il bot ha mandato il primo messaggio", actorId: null, actorName: "Bot WhatsApp",
  });
  return { started: true };
}

/** Called right after a lead arrives: never throws (intake must not fail because of WhatsApp) */
export async function onNewLead(lead: Lead): Promise<void> {
  try {
    const s = await getSettings();
    if (s.playbook.enabled) {
      // Playbook: first message by angle after 3 minutes (the cron sends it; this timer only makes it punctual)
      const { scheduleFirstMessage, runPlaybookSales } = await import("@/lib/vendiora/engine");
      const r = await scheduleFirstMessage(lead, s);
      if (r.started && process.env.LEAD_CRON_ENABLED === "1") setTimeout(() => void runPlaybookSales().catch(() => {}), 3 * 60_000 + 5_000);
      else if (!r.started) console.log(`[vendiora playbook] ${lead.id}: ${r.reason}`);
      return;
    }
    const r = await startBotForLead(lead);
    if (!r.started && r.reason !== "bot spento") console.log(`[vendiora bot] ${lead.id}: ${r.reason}`);
  } catch (e) {
    console.error("[vendiora bot]", e instanceof Error ? e.message : e);
    await addLeadEvent({
      leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null,
      note: `WhatsApp: primo messaggio NON inviato (${e instanceof Error ? e.message : "errore"})`, actorId: null, actorName: "Bot WhatsApp",
    }).catch(() => {});
  }
}

async function handoff(bot: BotSettings, lead: Lead, conv: Conversation, title: string, body: string) {
  const ids = bot.handoffUserIds;
  const url = `${APP_URL}/leads/${lead.id}`;
  await sendPush({ title, body, url, tag: `wa-${lead.id}` }, ids.length ? ids : undefined).catch(() => 0);
  for (const userId of ids) {
    await createNotification({
      userId, type: "lead_whatsapp", title, body, relatedId: lead.id, relatedType: "lead", fromUserName: "Bot WhatsApp",
    }).catch((e) => console.error("[vendiora notify]", e));
  }
  void conv;
}

export interface InboundMessage {
  id: string;
  chatId: string;
  phone: string | null;
  fromMe: boolean;
  text: string;
  ts: number;
  pushName: string | null;
}

export async function handleInbound(m: InboundMessage): Promise<{ handled: string }> {
  const phoneE164 = m.phone ? normalizePhone(`+${m.phone.replace(/\D/g, "")}`) : null;
  let conv = await findConversation(phoneE164, m.chatId);
  let leadId = conv?.leadId ?? null;
  if (!leadId && phoneE164) leadId = (await findLeadsByPhone(phoneE164))[0]?.id ?? null;
  const at = new Date(m.ts || Date.now()).toISOString();

  // Messages typed on the phone itself: keep them in the chat history and stop the bot
  if (m.fromMe) {
    const saved = await addMessage({ leadId, clientId: null, phoneE164: phoneE164 ?? conv?.phoneE164 ?? null, direction: "out", author: "telefono", text: m.text, waId: m.id, at });
    if (saved && conv && (conv.state === "attivo" || conv.state === "in_attesa")) {
      await saveConversation({ ...conv, state: "passato", handoffAt: conv.handoffAt ?? at });
    }
    return { handled: saved ? "outgoing-logged" : "duplicate" };
  }

  const saved = await addMessage({ leadId, clientId: null, phoneE164: phoneE164 ?? conv?.phoneE164 ?? null, direction: "in", author: m.pushName || "lead", text: m.text, waId: m.id, at });
  if (!saved) return { handled: "duplicate" };
  if (leadId) await updateLead(leadId, { lastContactAt: at }).catch(() => {});
  // Clients in delivery: check-in of Friday, G7 vote, NPS
  if (phoneE164 && (!conv || conv.state === "passato" || conv.state === "fermo")) {
    const { findClientByPhone } = await import("@/lib/vendiora/db");
    const cl = await findClientByPhone(phoneE164).catch(() => null);
    if (cl?.ops.awaiting) {
      const { clientInbound } = await import("@/lib/vendiora/engine");
      const r = await clientInbound(cl, m.text, at);
      if (r) return { handled: r };
    }
  }
  if (!conv || !leadId) return { handled: leadId ? "logged-no-bot" : "unknown-number" };
  if (!conv.chatIds.includes(m.chatId)) conv.chatIds.push(m.chatId);

  const lead = await getLead(leadId);
  if (!lead) return { handled: "lead-missing" };
  const settings = await getSettings();
  const bot = settings.bot;

  if ((conv.state === "in_attesa" || conv.state === "attivo") && conv.seqLog?.created && settings.playbook.enabled) {
    const { playbookAnswer } = await import("@/lib/vendiora/engine");
    const r = await playbookAnswer(conv, lead, m.text, at, settings);
    if (r === "qualified") {
      const c2 = await findConversation(phoneE164, m.chatId);
      await handoff(bot, lead, conv, `${lead.name}: ${c2?.qual === "qualificato" ? "qualificato ✅" : "in nurturing"}`, `Punteggio ${c2?.score ?? "—"}/100${c2?.angle ? ` · ${c2.angle}` : ""}: apri la scheda e fissa la call`);
    }
    return { handled: r };
  }

  if (conv.state === "in_attesa" || conv.state === "attivo") {
    const q = bot.questions[conv.step];
    // Lead answered several messages in a row: append to the same answer
    const prev = conv.answers.find((a) => a.q === q);
    if (q && prev) prev.a = `${prev.a}\n${m.text}`;
    else if (q) conv.answers.push({ q, a: m.text });
    const next = bot.questions[conv.step + 1];
    if (next && !prev) {
      conv = await saveConversation({ ...conv, step: conv.step + 1, state: "attivo", lastInboundAt: at });
      await sendAndLog(conv.phoneE164, next, lead.id, "bot");
      await saveConversation({ ...conv, state: "in_attesa" });
      return { handled: "next-question" };
    }
    if (next && prev) {
      await saveConversation({ ...conv, lastInboundAt: at });
      return { handled: "answer-appended" };
    }
    // Last answer: closing message + handoff
    await sendAndLog(conv.phoneE164, render(bot.closing, vars(bot, lead)), lead.id, "bot");
    await saveConversation({ ...conv, step: bot.questions.length, state: "passato", lastInboundAt: at, handoffAt: at });
    const summary = conv.answers.map((a, i) => `${i + 1}. ${a.q}\n→ ${a.a}`).join("\n\n");
    await addLeadEvent({
      leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null,
      note: `WhatsApp: qualifica completata\n\n${summary}`, actorId: null, actorName: "Bot WhatsApp",
    });
    await handoff(bot, lead, conv, `${lead.name} ha risposto al bot ✅`, "Qualifica completata: apri la chat e fissa la call");
    return { handled: "handoff" };
  }

  // Bot finished or stopped: a person takes over. Alert at most once every 30 minutes per chat.
  const last = conv.lastInboundAt ? Date.parse(conv.lastInboundAt) : 0;
  await saveConversation({ ...conv, lastInboundAt: at });
  if (Date.now() - last > 30 * 60_000) {
    await handoff(bot, lead, conv, `WhatsApp da ${lead.name}`, m.text.slice(0, 140));
  }
  return { handled: "human" };
}

/** A person writes from the CRM: send, log, stop the bot for this lead */
export async function sendFromCrm(lead: Lead, text: string, actorName: string) {
  if (!lead.phoneE164) throw new Error("Il lead non ha un numero di telefono valido");
  const r = await sendAndLog(lead.phoneE164, text, lead.id, actorName);
  const conv = await getConversationByLead(lead.id);
  const now = new Date().toISOString();
  await saveConversation({
    id: conv?.id,
    leadId: lead.id,
    phoneE164: lead.phoneE164,
    chatIds: [...(conv?.chatIds ?? []), r.chatId, r.lid].filter((x): x is string => !!x),
    state: "passato",
    step: conv?.step ?? 0,
    answers: conv?.answers ?? [],
    lastInboundAt: conv?.lastInboundAt ?? null,
    handoffAt: conv?.handoffAt ?? now,
  });
  await updateLead(lead.id, { lastContactAt: now, firstContactAt: lead.firstContactAt ?? now });
}

export async function setBotState(leadId: string, state: "fermo" | "passato") {
  const conv = await getConversationByLead(leadId);
  if (conv) await saveConversation({ ...conv, state });
}
