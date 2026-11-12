// VendiOra playbook engine: runs the Operations & Sales Playbook on top of the CRM.
// - Sales: first message 3 min after the lead arrives (by angle), 3 qualifying questions + score, M1–M3, no-show.
// - Offer in signature: sign + payment link, reminders at 4 h / 24 h / 48 h, M4 (signed not paid).
// - Activation (M5): calls created per package with code and deadline, welcome kit, onboarding G0–G10.
// - Delivery: M6 for every call, M7 weekly rhythm (Consulenza), M8 production deadlines (DFY), M9 installments,
//   M10 end of path (review, NPS, upsell, referral, Alumni), health score green/yellow/red, upsell pipeline U1–U6.
// - Tasks for the team (calls, voice notes, escalations) with push + in-app notification.
// Everything is idempotent (keys in ops.sent / offer.autoLog / conversation.seqLog) and never throws to the caller.
// Only the instance with LEAD_CRON_ENABLED=1 runs the timed part (see instrumentation.ts).

import { addLeadEvent, getLead, listLeads, updateLead } from "@/lib/db/leads";
import { createNotification } from "@/lib/db/notifications";
import { APP_URL, sendMail, sendPush, esc } from "@/lib/leads/notify";
import { isBlockedUser } from "@/lib/roles";
import type { Lead } from "@/lib/leads/types";
import {
  addMessage, createCall, createClient, createTaskOnce, deleteCall, getClient, getSettings, listCalls, listClients, listConversations,
  listOffers, nextContractNumber, saveConversation, updateCall, updateClient, updateOffer, getPackage, listPackages, findClientByLead,
  getConversationByLead, createPackage, updatePackage, listTasks,
} from "@/lib/vendiora/db";
import { waConfigured, waSend } from "@/lib/vendiora/wa";
import {
  eur, fillTemplate, type ClientOps, type Conversation, type TaskRole, type VdCall, type VdClient, type VdOffer, type VendioraSettings,
} from "@/lib/vendiora/types";
import {
  ANGLE_INFO, CONTINUOUS_SERVICES, PLAYBOOK_PACKAGES, VALUE_LADDER, angleFromText, callDueAt, computeHealth, computeStage, isAngle,
  midpointDays, playbookPackage, qualify, recommendPackage, type Angle, type PlaybookPackage,
} from "@/lib/vendiora/playbook";
import { PB_BY_ID, pbText } from "@/lib/vendiora/playbook-messages";
import { installments } from "@/lib/vendiora/contract";
import { calLink, type CalWho } from "@/lib/vendiora/cal-links";

const H = 3_600_000;
const D = 24 * H;
/** Scheduled messages older than this are skipped (no burst of old messages after a pause / first deploy) */
const WINDOW = 36 * H;
const TZ = "Europe/Rome";

const firstName = (name: string) => (name || "").trim().split(/\s+/)[0] || "";
const dLong = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }) : "");
const dShort = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: TZ }) : "");
const tIt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "");
const ts = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/** Rome wall clock of a timestamp */
function rome(t: number) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { day: `${p.year}-${p.month}-${p.day}`, wd, hour: Number(p.hour), minute: Number(p.minute) };
}
/** Timestamp of Rome day (YYYY-MM-DD of t + addDays) at hh:00 */
function romeAt(t: number, addDays: number, hh: number): number {
  const r = rome(t);
  const guess = Date.parse(`${r.day}T${String(hh).padStart(2, "0")}:00:00Z`) + addDays * D;
  // correct for the Rome offset (1 or 2 hours)
  const off = (rome(guess).hour - hh + 24) % 24;
  return guess - off * H;
}

// ---------------------------------------------------------------------------
// Rendering + delivery
// ---------------------------------------------------------------------------

function render(t: string, v: Record<string, string>) {
  const out = fillTemplate(t, v).replace(/\{(\w+)\}/g, "");
  return out
    .split("\n")
    .filter((l) => !/^\s*[^\p{L}\p{N}]*👉\s*$/u.test(l))
    .map((l) => l.replace(/\s*👉\s*$/u, "").replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface Ctx {
  s: VendioraSettings;
  now: number;
  out: Record<string, number>;
}

const inc = (c: Ctx, k: string) => { c.out[k] = (c.out[k] ?? 0) + 1; };

export function teamIds(s: VendioraSettings, role: TaskRole): string[] {
  const t = s.playbook.team;
  const ids = t[role]?.length ? t[role] : role === "coach" || role === "pm" ? t.csm : role === "ceo" ? t.admin : [];
  return [...new Set([...(ids.length ? ids : t.admin.length ? t.admin : s.bot.handoffUserIds)])].filter((id) => !isBlockedUser(id));
}

/** Team task + push + in-app notification. Idempotent by key. */
export async function task(c: Ctx, o: { key: string; msgId?: string; title?: string; text?: string; role?: TaskRole; vars: Record<string, string>; clientId?: string | null; leadId?: string | null; dueAt?: string | null; urgent?: boolean }) {
  const def = o.msgId ? PB_BY_ID.get(o.msgId) : null;
  const raw = o.msgId ? pbText(o.msgId, c.s.playbook.messages) : o.text ?? "";
  if (raw == null) return false;
  const role = o.role ?? def?.role ?? "admin";
  const title = `${o.title ?? def?.title ?? "Attività"} · ${o.vars.nomecompleto || o.vars.nome || ""}`.replace(/ · $/, "");
  const t = await createTaskOnce({
    key: o.key, clientId: o.clientId ?? null, leadId: o.leadId ?? null, title, detail: render(raw, o.vars), role,
    dueAt: o.dueAt ?? new Date(c.now).toISOString(), urgent: !!o.urgent,
  }).catch((e) => { console.error("[vendiora task]", e instanceof Error ? e.message : e); return null; });
  if (!t) return false;
  const ids = teamIds(c.s, role);
  const url = o.clientId ? `${APP_URL}/vendiora/clienti/${o.clientId}` : o.leadId ? `${APP_URL}/leads/${o.leadId}` : `${APP_URL}/vendiora/task`;
  await sendPush({ title, body: (t.detail ?? "").slice(0, 160), url, tag: `vdt-${t.id}` }, ids.length ? ids : undefined).catch(() => 0);
  for (const userId of ids) {
    await createNotification({
      userId, type: "lead_whatsapp", title, body: (t.detail ?? "").slice(0, 400),
      relatedId: o.leadId ?? o.clientId ?? null, relatedType: o.leadId ? "lead" : null, fromUserName: c.s.playbook.brand || "VendiOra",
    }).catch(() => {});
  }
  inc(c, "tasks");
  return true;
}

async function wa(c: Ctx, phone: string | null, text: string, ref: { leadId: string | null; clientId: string | null; note: string }) {
  if (!phone || !waConfigured() || !text) return false;
  const r = await waSend(phone, text);
  const at = new Date().toISOString();
  await addMessage({ leadId: ref.leadId, clientId: ref.clientId, phoneE164: phone, direction: "out", author: "automatico", text, waId: r.id, at });
  if (ref.leadId) {
    await updateLead(ref.leadId, { lastContactAt: at }).catch(() => {});
    await addLeadEvent({ leadId: ref.leadId, type: "note", outcome: null, fromStatus: null, toStatus: null, note: `WhatsApp automatico: ${ref.note}`, actorId: null, actorName: c.s.playbook.brand || "VendiOra" }).catch(() => {});
  }
  inc(c, "wa");
  return true;
}

async function mail(c: Ctx, to: string | null, subject: string, text: string) {
  if (!to || !to.includes("@") || !text) return false;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#111">${esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>")}</div>`;
  const ok = await sendMail([to], subject, html, text);
  if (ok) inc(c, "email");
  return ok;
}

/** Sends playbook message `id` on its channel; returns true when sent (or created, for tasks) */
async function say(c: Ctx, id: string, to: { phone: string | null; email: string | null; leadId: string | null; clientId: string | null; name: string }, vars: Record<string, string>, key: string) {
  const def = PB_BY_ID.get(id);
  if (!def) return false;
  if (def.channel === "task") return task(c, { key, msgId: id, vars, clientId: to.clientId, leadId: to.leadId });
  const raw = pbText(id, c.s.playbook.messages);
  if (raw == null) return true; // switched off: count as done
  const text = render(raw, vars);
  try {
    if (def.channel === "email") return await mail(c, to.email, `${c.s.playbook.brand || "VendiOra"} · ${def.when.split(":")[0].replace(/\s*\(.*$/, "")}`, text);
    return await wa(c, to.phone, text, { leadId: to.leadId, clientId: to.clientId, note: `${def.group} ${def.when}` });
  } catch (e) {
    console.error(`[vendiora pb ${id}]`, e instanceof Error ? e.message : e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

function baseVars(s: VendioraSettings, name: string, who?: CalWho): Record<string, string> {
  const L = s.playbook.links;
  return {
    nome: firstName(name),
    nomecompleto: name,
    brand: s.playbook.brand || s.company.name || "VendiOra",
    commerciale: s.playbook.commerciale || s.bot.handoffName || "il nostro team",
    referente: s.bot.handoffName || s.playbook.commerciale || "il nostro team",
    link: calLink(s, L.salesBooking || s.bot.calendlyUrl || "", who && { name, ...who }),
    linkcall: L.salesCall ? ` Link della call 👉 ${L.salesCall}` : "",
    video: L.preframeVideo,
  };
}

const callLabel = (call: Pick<VdCall, "code" | "title">) => (call.code ? `call ${call.code} «${call.title.replace(/^[A-Z-]+C\d+\s*·\s*/, "")}»` : call.title.toLowerCase().startsWith("call") ? call.title : `call «${call.title}»`);

function clientVars(s: VendioraSettings, cl: VdClient, extra: Record<string, string> = {}): Record<string, string> {
  const L = s.playbook.links;
  const pkg = playbookPackage(cl.packageCode);
  const booking = pkg?.line === "dfy" ? L.pmBooking || L.coachBooking : L.coachBooking || L.csmBooking;
  return {
    ...baseVars(s, cl.name, { email: cl.email, phone: cl.phoneE164, ref: `c:${cl.id}` }),
    pacchetto: cl.packageName,
    prezzo: eur(cl.price),
    coach: cl.coach || "il tuo coach",
    link: calLink(s, booking || s.bot.coachingBookingUrl || s.bot.calendlyUrl || "", { name: cl.name, email: cl.email, phone: cl.phoneE164, ref: `c:${cl.id}` }),
    gruppo: L.whatsappGroup,
    video: L.welcomeVideo,
    kpi: cl.ops.kpiName || "vendite della settimana",
    obiettivo: cl.ops.objective || "",
    ...extra,
  };
}

const target = (cl: VdClient) => ({ phone: cl.phoneE164, email: cl.email, leadId: cl.leadId, clientId: cl.id, name: cl.name });

// ---------------------------------------------------------------------------
// Packages seed (idempotent by code)
// ---------------------------------------------------------------------------

export async function seedPlaybookPackages(): Promise<{ created: string[]; updated: string[] }> {
  const existing = await listPackages();
  const created: string[] = [];
  const updated: string[] = [];
  for (const p of PLAYBOOK_PACKAGES) {
    const data = {
      name: p.name, code: p.code, tagline: p.forWho, deliverables: p.sheet.join("\n"), price: p.price, vatRate: 22,
      includedCalls: p.calls.length, buildDays: p.line === "dfy" ? 7 : 0, coachingDays: p.weeks * 7 || 45,
      guarantee: null, paymentTerms: "Unica soluzione o rate, come indicato nell'offerta (art. 3 del contratto).", active: true, sortOrder: p.sortOrder,
    };
    const found = existing.find((e) => e.code === p.code) ?? existing.find((e) => !e.code && e.name.trim().toLowerCase() === p.name.toLowerCase());
    if (found) {
      // never overwrite a price the admin changed: only fill what is empty
      await updatePackage(found.id, { code: p.code, includedCalls: p.calls.length, deliverables: found.deliverables || data.deliverables, tagline: found.tagline || data.tagline });
      updated.push(p.code);
    } else {
      await createPackage(data);
      created.push(p.code);
    }
  }
  return { created, updated };
}

// ---------------------------------------------------------------------------
// Calls plan per package
// ---------------------------------------------------------------------------

function anchors(cl: VdClient) {
  return { startAt: cl.ops.activatedAt ?? null, deliveryAt: cl.storeLiveAt, launchAt: cl.ops.adsLaunchedAt ?? null, accessesAt: cl.ops.accessesAt ?? null };
}

/** Creates the calls of the package (code + deadline). Generic uncoded calls not yet booked are replaced. */
export async function ensureCallPlan(cl: VdClient): Promise<VdCall[]> {
  const pkg = playbookPackage(cl.packageCode);
  const calls = await listCalls({ clientId: cl.id });
  if (!pkg) return calls;
  if (calls.some((x) => x.code)) return calls;
  for (const x of calls) if (!x.code && x.status === "da_prenotare") await deleteCall(x.id).catch(() => {});
  const keep = calls.filter((x) => x.status !== "da_prenotare");
  const out: VdCall[] = [...keep];
  for (const st of pkg.calls) {
    const old = keep.find((x) => x.number === st.n);
    const dueAt = callDueAt(st, pkg.code, anchors(cl));
    if (old) { out[out.indexOf(old)] = await updateCall(old.id, { code: st.code, title: `${st.code} · ${st.title}`, dueAt }); continue; }
    out.push(await createCall({
      clientId: cl.id, clientName: cl.name, number: st.n, title: `${st.code} · ${st.title}`, status: "da_prenotare",
      scheduledAt: null, doneAt: null, notes: `${st.when}\n\nCosa si fa: ${st.what}\nCompiti dopo la call: ${st.homework}\nDa portare alla call successiva: ${st.bring}`,
      code: st.code, dueAt,
    }));
  }
  return out.sort((a, b) => a.number - b.number);
}

async function refreshDueDates(cl: VdClient, calls: VdCall[]) {
  const pkg = playbookPackage(cl.packageCode);
  if (!pkg) return;
  for (const x of calls) {
    if (x.status === "fatta") continue;
    const st = pkg.calls.find((s) => s.n === x.number);
    if (!st) continue;
    const due = callDueAt(st, pkg.code, anchors(cl));
    if (due && due !== x.dueAt) { x.dueAt = due; await updateCall(x.id, { dueAt: due }).catch(() => {}); }
  }
}

// ---------------------------------------------------------------------------
// Activation (M5): contract signed + payment received
// ---------------------------------------------------------------------------

function kitText(pkg: PlaybookPackage | null, calls: VdCall[]) {
  const scheda = pkg ? pkg.sheet.map((l) => `• ${l}`).join("\n") : "";
  const cal = calls.map((x) => `• ${x.code ?? `Call ${x.number}`} ${x.title.replace(/^[A-Z-]+C\d+\s*·\s*/, "")}${x.dueAt ? ` – entro ${dShort(x.dueAt)}` : ""}`).join("\n");
  return { scheda, calendario: cal };
}

export async function activateClient(clientId: string, opts: { s?: VendioraSettings; now?: number } = {}): Promise<{ activated: boolean; reason?: string }> {
  try {
    const s = opts.s ?? (await getSettings());
    const c: Ctx = { s, now: opts.now ?? Date.now(), out: {} };
    let cl = await getClient(clientId);
    if (!cl) return { activated: false, reason: "cliente non trovato" };
    if (!cl.isPaid) return { activated: false, reason: "pagamento non ancora ricevuto" };
    if (!cl.packageCode && cl.packageId) {
      const p = await getPackage(cl.packageId);
      if (p?.code) cl = await updateClient(cl.id, { packageCode: p.code });
    }
    const pkg = playbookPackage(cl.packageCode);
    const nowIso = new Date(c.now).toISOString();
    const ops: ClientOps = { ...cl.ops };
    const first = !ops.activatedAt;
    if (first) {
      ops.activatedAt = cl.paidAt || nowIso;
      ops.referralCode = ops.referralCode || Math.random().toString(36).slice(2, 8).toUpperCase();
      if (pkg?.line === "dfy") ops.access = Object.fromEntries(pkg.access.map((a) => [a, false]));
      if (!ops.installments?.length) {
        const offer = (await listOffers()).find((o) => o.clientId === cl!.id);
        if (offer?.paymentLink) ops.paymentLink = offer.paymentLink;
        const rates = installments(cl.price, offer?.payPlan ?? null);
        if (rates.length > 1) {
          ops.installments = rates.map((r, i) => ({ n: i + 1, amount: r.amount, dueAt: new Date(ts(ops.activatedAt) + r.day * D).toISOString(), status: i === 0 ? "pagata" : "da_pagare", paidAt: i === 0 ? ops.activatedAt : null }));
          ops.paymentStatus = "a_rate";
        } else ops.paymentStatus = "saldato";
      }
      cl = await updateClient(cl.id, { ops, kickoffAt: cl.kickoffAt ?? null });
    }
    const calls = await ensureCallPlan(cl);
    await refreshDueDates(cl, calls);
    if (!first) return { activated: false, reason: "già attivo" };
    if (!s.playbook.enabled) return { activated: true };
    // M5 sequence (minute 0/5/10); the cron sends the timed follow-ups
    const L = s.playbook.links;
    const kit = kitText(pkg, calls);
    const v = clientVars(s, cl, {
      contratto: `${APP_URL}/vendiora/clienti/${cl.id}`,
      passo2: pkg?.line === "dfy" ? "Compila il brief e prepara gli accessi" : "Entra nel gruppo WhatsApp e compila il form di intake",
      ...kit,
      form: pkg?.line === "dfy" ? L.briefForm : L.intakeForm,
      elenco: (pkg?.access ?? []).map((a) => `• ${a}`).join("\n"),
      passaggio: [cl.ops.handover?.goal && `obiettivo: ${cl.ops.handover.goal}`, cl.ops.handover?.motivation && `motivazione: ${cl.ops.handover.motivation}`, cl.ops.handover?.fears && `paure: ${cl.ops.handover.fears}`, cl.ops.handover?.promises && `promesse fatte: ${cl.ops.handover.promises}`].filter(Boolean).join(" · ") || "da compilare nella scheda cliente",
    });
    const sent: Record<string, string> = { ...(cl.ops.sent ?? {}) };
    const seq = ["M5.contract", "M5.welcome", "M5.kit", "M5.book1", pkg?.line === "dfy" ? "M5.brief" : "M5.group", "M5.team"];
    for (const id of seq) {
      if (sent[id]) continue;
      if (await say(c, id, target(cl), id === "M5.book1" ? { ...v, link: v.link } : v, `${cl.id}:${id}`)) sent[id] = nowIso;
    }
    await updateClient(cl.id, { ops: { ...cl.ops, ...ops, sent } });
    return { activated: true };
  } catch (e) {
    console.error("[vendiora activate]", e instanceof Error ? e.message : e);
    return { activated: false, reason: e instanceof Error ? e.message : "errore" };
  }
}

/** Offer signed and paid → contract (client) + activation */
export async function clientFromOffer(o: VdOffer): Promise<VdClient> {
  if (o.clientId) {
    const cl = await getClient(o.clientId);
    if (cl) return cl;
  }
  const lead = o.leadId ? await getLead(o.leadId) : null;
  const byLead = lead ? await findClientByLead(lead.id) : null;
  if (byLead) {
    await updateOffer(o.id, { clientId: byLead.id });
    return byLead;
  }
  const pkg = o.packageId ? await getPackage(o.packageId) : null;
  const now = new Date().toISOString();
  const cl = await createClient({
    leadId: lead?.id ?? null, name: o.name, email: o.email ?? lead?.email ?? null, phone: lead?.phone ?? o.phoneE164, phoneE164: o.phoneE164 ?? lead?.phoneE164 ?? null,
    taxId: o.taxId ?? null, address: o.address ?? null, packageId: o.packageId, packageSnapshot: o.packageSnapshot ?? (pkg ? JSON.stringify(pkg) : null),
    packageName: o.packageName, price: o.price, vatRate: o.vatRate, paymentTerms: pkg?.paymentTerms ?? null, status: "onboarding",
    contractNumber: await nextContractNumber(), contractDate: o.signedAt ?? now, contractSignedAt: o.signedAt ?? null,
    isPaid: !!o.paidAt, paidAt: o.paidAt ?? null, packageCode: o.packageCode ?? pkg?.code ?? null,
  });
  await updateOffer(o.id, { clientId: cl.id, status: "accettata", answeredAt: o.answeredAt ?? now });
  if (lead && lead.status !== "vinto") {
    await updateLead(lead.id, { status: "vinto", value: o.price });
    await addLeadEvent({ leadId: lead.id, type: "status", outcome: null, fromStatus: lead.status, toStatus: "vinto", note: `Vendita registrata: «${o.packageName}» ${eur(o.price)} · offerta ${o.number} firmata${o.paidAt ? " e pagata" : ""}`, actorId: null, actorName: "VendiOra" }).catch(() => {});
  }
  return cl;
}

// ---------------------------------------------------------------------------
// Sales side: new lead, 3 questions, score, sequences M1–M3
// ---------------------------------------------------------------------------

function leadAngle(lead: Lead): Angle | null {
  return angleFromText(lead.campaign, lead.adset, lead.ad, lead.formName, lead.service, lead.formData?.slice(0, 2000));
}

/** Called when a lead arrives and the playbook is on: schedules the first message (sent by the cron after 3 minutes) */
export async function scheduleFirstMessage(lead: Lead, s: VendioraSettings): Promise<{ started: boolean; reason?: string }> {
  if (!lead.phoneE164) return { started: false, reason: "il lead non ha un numero valido" };
  const existing = await getConversationByLead(lead.id);
  if (existing) return { started: false, reason: "già contattato" };
  const angle = leadAngle(lead);
  await saveConversation({
    leadId: lead.id, phoneE164: lead.phoneE164, chatIds: [], state: "programmato", step: 0, answers: [], lastInboundAt: null, handoffAt: null,
    angle, score: null, qual: null, pkg: null, seqLog: { created: new Date().toISOString() },
  });
  await addLeadEvent({ leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null, note: `Playbook: primo WhatsApp in partenza tra 3 minuti${angle ? ` (angle ${angle})` : ""}`, actorId: null, actorName: s.playbook.brand || "VendiOra" }).catch(() => {});
  // Referral: campaign "REF-ABC123" → credits the client who shared the link
  const ref = /\bREF-([A-Z0-9]{6})\b/i.exec([lead.campaign, lead.formData].filter(Boolean).join(" "));
  if (ref) {
    const code = ref[1].toUpperCase();
    const owner = (await listClients()).find((x) => x.ops.referralCode === code);
    if (owner) {
      await updateClient(owner.id, { ops: { ...owner.ops, referrals: [...(owner.ops.referrals ?? []), { at: new Date().toISOString(), leadId: lead.id, name: lead.name }] } });
      await addLeadEvent({ leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null, note: `Referral di ${owner.name}`, actorId: null, actorName: "VendiOra" }).catch(() => {});
    }
  }
  return { started: true };
}

function questionsFor(s: VendioraSettings, angle: string | null) {
  const a = isAngle(angle) ? angle : "none";
  const first = pbText(`M1.first.${a}`, s.playbook.messages) ?? "";
  // The question is the last sentence of the first message
  const q1 = first.split(/(?<=[.!])\s+/).filter((x) => x.includes("?")).pop() ?? first;
  return [q1, pbText("M1.q2", s.playbook.messages) ?? "", (pbText("M1.q3", s.playbook.messages) ?? "")];
}

/** Inbound answer while the playbook bot is qualifying. Returns true when handled. */
export async function playbookAnswer(conv: Conversation, lead: Lead, text: string, at: string, s: VendioraSettings): Promise<string> {
  const c: Ctx = { s, now: Date.now(), out: {} };
  const qs = questionsFor(s, conv.angle ?? null);
  const step = Math.min(conv.step, 2);
  const prev = conv.answers.find((a) => a.q === qs[step]);
  if (prev) {
    prev.a = `${prev.a}\n${text}`;
    await saveConversation({ ...conv, lastInboundAt: at });
    return "answer-appended";
  }
  conv.answers.push({ q: qs[step], a: text });
  const v = { ...baseVars(s, lead.name, { email: lead.email, phone: lead.phoneE164, ref: `l:${lead.id}` }) };
  if (step < 2) {
    const next = qs[step + 1];
    conv = await saveConversation({ ...conv, step: step + 1, state: "attivo", lastInboundAt: at });
    await wa(c, conv.phoneE164, render(next, v), { leadId: lead.id, clientId: null, note: `domanda ${step + 2} di 3` });
    await saveConversation({ ...conv, state: "in_attesa" });
    return "next-question";
  }
  const answers = qs.map((q) => conv.answers.find((a) => a.q === q)?.a ?? "");
  const q = qualify(answers);
  const pkg = recommendPackage(isAngle(conv.angle) ? conv.angle : null, q.mode);
  const qual = q.qualified ? "qualificato" : "nurturing";
  const msg = q.qualified ? "M1.qualified" : "M1.nurturing";
  const link = q.qualified ? v.link : s.playbook.links.freeContent;
  const raw = pbText(msg, s.playbook.messages);
  if (raw) await wa(c, conv.phoneE164, render(raw, { ...v, link }), { leadId: lead.id, clientId: null, note: q.qualified ? "lead qualificato: link per la call" : "lead in nurturing" });
  await saveConversation({ ...conv, step: 3, state: "passato", lastInboundAt: at, handoffAt: at, score: q.score, qual, pkg, seqLog: { ...(conv.seqLog ?? {}), [`qual`]: at } });
  const summary = answers.map((a, i) => `${i + 1}. ${qs[i]}\n→ ${a}`).join("\n\n");
  await addLeadEvent({
    leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null,
    note: `Qualifica WhatsApp: ${qual.toUpperCase()} · punteggio ${q.score}/100${conv.angle ? ` · angle ${conv.angle}` : ""}\nPacchetto da proporre: ${playbookPackage(pkg)?.name ?? pkg}\n\n${summary}`,
    actorId: null, actorName: "Bot WhatsApp",
  });
  await updateLead(lead.id, q.qualified ? { status: lead.status === "nuovo" ? "da_richiamare" : lead.status, nextActionNote: `Qualificato (${q.score}/100): fissare la call` } : { nextActionNote: "Nurturing" }).catch(() => {});
  return "qualified";
}

const SALES_STEPS = ["M1.nudge2h", "M1.voice1d", "M1.problem3d", "M1.close7d"] as const;

async function runSales(c: Ctx) {
  const s = c.s;
  const convs = await listConversations();
  const leads = new Map((await listLeads({ max: 3000 })).map((l) => [l.id, l]));
  // Leads that already have an offer on the table or are clients: the sales sequence stops (offers/clients have their own)
  const [offersAll, clientsAll] = await Promise.all([listOffers().catch(() => []), listClients().catch(() => [])]);
  const busy = new Set<string>([
    ...offersAll.filter((o) => o.leadId && !["bozza", "rifiutata", "scaduta"].includes(o.status)).map((o) => o.leadId!),
    ...clientsAll.filter((x) => x.leadId).map((x) => x.leadId!),
  ]);
  for (const conv of convs) {
    if (!conv.leadId) continue;
    const lead = leads.get(conv.leadId);
    if (!lead) continue;
    if (busy.has(lead.id) || lead.status === "vinto") {
      if (conv.state === "programmato" || conv.state === "in_attesa" || conv.state === "attivo") await saveConversation({ ...conv, state: "passato" }).catch(() => {});
      continue;
    }
    if (lead.status === "perso" && conv.qual !== "nurturing") continue;
    const log = { ...(conv.seqLog ?? {}) };
    const mark = async (k: string) => { log[k] = new Date(c.now).toISOString(); await saveConversation({ ...conv, seqLog: log }); };
    const v = { ...baseVars(s, lead.name, { email: lead.email, phone: lead.phoneE164, ref: `l:${lead.id}` }), angle: conv.angle ?? "—", problema: isAngle(conv.angle) ? ANGLE_INFO[conv.angle].problem : "bisogno di una mano con il tuo ecommerce" };
    const created = ts(log.created) || ts(lead.createdAt);
    try {
      // First message 3 minutes after arrival
      if (conv.state === "programmato") {
        if (c.now - created < 3 * 60_000) continue;
        if (c.now - created > 2 * D) { await saveConversation({ ...conv, state: "fermo" }); continue; }
        if (!s.bot.enabled || !waConfigured()) continue;
        const a = isAngle(conv.angle) ? conv.angle : "none";
        const raw = pbText(`M1.first.${a}`, s.playbook.messages);
        if (!raw) continue;
        const r = await waSend(conv.phoneE164, render(raw, v));
        const at = new Date().toISOString();
        await addMessage({ leadId: lead.id, clientId: null, phoneE164: conv.phoneE164, direction: "out", author: "bot", text: render(raw, v), waId: r.id, at });
        await saveConversation({ ...conv, chatIds: [r.chatId, r.lid].filter((x): x is string => !!x), state: "in_attesa", step: 0, seqLog: { ...log, first: at } });
        await updateLead(lead.id, { firstContactAt: lead.firstContactAt ?? at, lastContactAt: at });
        await addLeadEvent({ leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null, note: `WhatsApp: primo messaggio (angle ${conv.angle ?? "non indicato"})`, actorId: null, actorName: "Bot WhatsApp" });
        inc(c, "first");
        continue;
      }
      const first = ts(log.first);
      // No answer at all: +2h, +1d 10:00, +3d 18:00, +7d close
      if (conv.state === "in_attesa" && conv.step === 0 && !conv.lastInboundAt && first) {
        const due: Record<(typeof SALES_STEPS)[number], number> = {
          "M1.nudge2h": first + 2 * H, "M1.voice1d": romeAt(first, 1, 10), "M1.problem3d": romeAt(first, 3, 18), "M1.close7d": first + 7 * D,
        };
        for (const id of SALES_STEPS) {
          if (log[id] || c.now < due[id] || c.now - due[id] > WINDOW) continue;
          if (await say(c, id, { phone: conv.phoneE164, email: lead.email, leadId: lead.id, clientId: null, name: lead.name }, v, `${lead.id}:${id}`)) await mark(id);
          if (id === "M1.close7d") {
            await saveConversation({ ...conv, state: "passato", qual: "nurturing", seqLog: log });
            await addLeadEvent({ leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null, note: "Playbook: nessuna risposta in 7 giorni → Nurturing", actorId: null, actorName: "VendiOra" }).catch(() => {});
          }
          break;
        }
      }
      // Partial answers for 24 h: repeat the missing question once per step
      if ((conv.state === "in_attesa" || conv.state === "attivo") && conv.step > 0 && conv.lastInboundAt) {
        const k = `M1.repeat24h:${conv.step}`;
        const due = ts(conv.lastInboundAt) + D;
        if (!log[k] && c.now >= due && c.now - due < WINDOW) {
          const qs = questionsFor(s, conv.angle ?? null);
          if (await say(c, "M1.repeat24h", { phone: conv.phoneE164, email: null, leadId: lead.id, clientId: null, name: lead.name }, { ...v, domanda: qs[Math.min(conv.step, 2)] }, `${lead.id}:${k}`)) await mark(k);
        }
      }
      // Nurturing emails: +14 g, +30 g, then every 30 g
      if (conv.qual === "nurturing" && lead.email) {
        const base = ts(log.qual) || first || created;
        const n = Math.floor((c.now - base) / D);
        const slot = n >= 14 && n < 30 ? 14 : n >= 30 ? 30 * Math.floor(n / 30) : 0;
        const k = `M1.nurture:${slot}`;
        if (slot && !log[k]) { if (await say(c, "M1.nurtureEmail", { phone: null, email: lead.email, leadId: lead.id, clientId: null, name: lead.name }, { ...v, link: s.playbook.links.freeContent }, `${lead.id}:${k}`)) await mark(k); }
      }
      // Qualified, no call booked after 1 h → phone task
      if (conv.qual === "qualificato" && log.qual && !log["M1.callNow"] && c.now - ts(log.qual) > H && !["appuntamento", "proposta", "vinto", "perso"].includes(lead.status)) {
        if (await say(c, "M1.callNow", { phone: null, email: null, leadId: lead.id, clientId: null, name: lead.name }, v, `${lead.id}:M1.callNow`)) await mark("M1.callNow");
      }
      // M2: sales call booked (lead status "appuntamento" + date)
      if (lead.status === "appuntamento" && lead.nextActionAt) {
        const t = ts(lead.nextActionAt);
        const tag = lead.nextActionAt.slice(0, 16);
        const vv = { ...v, data: dLong(lead.nextActionAt), ora: tIt(lead.nextActionAt), storehint: conv.angle === "A-SISTEMA" || conv.angle === "A-SCALA" ? " Tieni a portata di mano il link del tuo store." : "", linkcall: (typeof log[`calMeet:${tag}`] === "string" && log[`calMeet:${tag}`]) || s.playbook.links.salesCall };
        const steps: [string, number, boolean?][] = [
          ["M2.confirm", ts(log[`booked:${tag}`] ?? "") || c.now],
          ["M2.preframe", (ts(log[`booked:${tag}`] ?? "") || c.now) + 5 * 60_000],
          ["M2.t24", t - D], ["M2.noConfirm", t - 20 * H], ["M2.t3", t - 3 * H], ["M2.t15", t - 15 * 60_000],
        ];
        if (!log[`booked:${tag}`]) await mark(`booked:${tag}`);
        for (const [id, due] of steps) {
          const k = `${id}:${tag}`;
          if (log[k] || c.now < due || c.now >= t) continue;
          if (id === "M2.noConfirm" && conv.lastInboundAt && ts(conv.lastInboundAt) > ts(log[`M2.t24:${tag}`] ?? "") ) { await mark(k); continue; }
          if (id === "M2.noConfirm" && !log[`M2.t24:${tag}`]) continue;
          if (id === "M2.preframe" && !s.playbook.links.preframeVideo) { await mark(k); continue; }
          if (await say(c, id, { phone: conv.phoneE164, email: lead.email, leadId: lead.id, clientId: null, name: lead.name }, id === "M2.t15" && !vv.linkcall ? { ...vv, linkcall: "" } : vv, `${lead.id}:${k}`)) await mark(k);
        }
      }
      // No-show recovery (marked from the lead page): +5 min done there, then +1h, +1d, +3d
      if (log.noShowAt && !["vinto", "perso"].includes(lead.status)) {
        const ns = ts(log.noShowAt);
        for (const [id, due] of [["M2.rebook1h", ns + H], ["M2.rebook1d", ns + D], ["M2.rebook3d", ns + 3 * D]] as const) {
          const k = `${id}:${log.noShowAt}`;
          if (log[k] || c.now < due || c.now - due > WINDOW) continue;
          if (lead.status === "appuntamento" && lead.nextActionAt && ts(lead.nextActionAt) > ns) break; // rebooked
          if (await say(c, id, { phone: conv.phoneE164, email: null, leadId: lead.id, clientId: null, name: lead.name }, v, `${lead.id}:${k}`)) await mark(k);
          break;
        }
      }
    } catch (e) {
      console.error("[vendiora sales]", lead.id, e instanceof Error ? e.message : e);
    }
  }
}

/** No-show at the sales call: message + phone task now, recovery sequence from the cron */
export async function salesNoShow(lead: Lead): Promise<void> {
  const s = await getSettings();
  const c: Ctx = { s, now: Date.now(), out: {} };
  const conv = await getConversationByLead(lead.id);
  const at = new Date().toISOString();
  const v = baseVars(s, lead.name, { email: lead.email, phone: lead.phoneE164, ref: `l:${lead.id}` });
  const to = { phone: lead.phoneE164, email: lead.email, leadId: lead.id, clientId: null, name: lead.name };
  await say(c, "M2.absent", to, v, `${lead.id}:M2.absent:${at}`);
  await say(c, "M2.absentCall", to, v, `${lead.id}:M2.absentCall:${at}`);
  if (conv) await saveConversation({ ...conv, seqLog: { ...(conv.seqLog ?? {}), noShowAt: at } });
  else if (lead.phoneE164) await saveConversation({ leadId: lead.id, phoneE164: lead.phoneE164, chatIds: [], state: "passato", step: 3, answers: [], lastInboundAt: null, handoffAt: at, seqLog: { noShowAt: at } });
  await addLeadEvent({ leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null, note: "No-show alla call di vendita: parte la sequenza di recupero (1 h, 1 g, 3 g)", actorId: null, actorName: "VendiOra" }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Offers: in signature (4h/24h/48h), signed not paid (M4), proposal follow-up (M3)
// ---------------------------------------------------------------------------

export function offerLinkVars(s: VendioraSettings, o: VdOffer): Record<string, string> {
  return {
    ...baseVars(s, o.name),
    pacchetto: o.packageName,
    prezzo: eur(o.price),
    link: `${APP_URL}/offerta/${o.token}`,
    pagamento: o.paymentLink ? `\n\nPagamento 👉 ${o.paymentLink}` : "",
    obiettivo: o.message ?? "",
  };
}

async function runOffers(c: Ctx) {
  for (const o of await listOffers()) {
    if (o.status === "bozza" || o.status === "rifiutata") continue;
    const log = { ...(o.autoLog ?? {}) };
    const to = { phone: o.phoneE164, email: o.email, leadId: o.leadId, clientId: o.clientId, name: o.name };
    const v = offerLinkVars(c.s, o);
    const mark = async (k: string) => { log[k] = new Date(c.now).toISOString(); await updateOffer(o.id, { autoLog: log }); };
    try {
      if (o.status === "scaduta") continue;
      if (o.validUntil && ts(o.validUntil) < c.now && !o.signedAt) {
        await updateOffer(o.id, { status: "scaduta" });
        inc(c, "expired");
        if (o.mode === "proposta" && !log["M3.lost"] && await say(c, "M3.lost", to, v, `${o.id}:M3.lost`)) await mark("M3.lost");
        continue;
      }
      const sent = ts(o.sentAt);
      if (!o.signedAt && sent) {
        if (o.mode === "proposta") {
          const obj = o.objection && PB_BY_ID.has(`M3.obj.${o.objection}`) ? `M3.obj.${o.objection}` : "M3.obj.generic";
          const steps: [string, number][] = [["M3.recap", sent + H], [obj, sent + D], ["M3.call3d", sent + 3 * D], ["M3.case5d", sent + 5 * D], ["M3.close7d", sent + 7 * D], ["M3.lost", sent + 8 * D]];
          for (const [id, due] of steps) {
            const k = id.startsWith("M3.obj") ? "M3.obj" : id;
            if (log[k] || c.now < due || c.now - due > WINDOW) continue;
            const vv = id === "M3.case5d" ? { ...v, link: c.s.playbook.links.caseStudy } : v;
            if (id === "M3.case5d" && !c.s.playbook.links.caseStudy) { await mark(k); continue; }
            if (await say(c, id, to, vv, `${o.id}:${k}`)) await mark(k);
            if (id === "M3.lost") await updateOffer(o.id, { status: "scaduta" });
          }
        } else {
          for (const [id, due] of [["OF.sign4h", sent + 4 * H], ["OF.call24h", sent + D], ["OF.last48h", sent + 2 * D]] as const) {
            if (log[id] || c.now < due || c.now - due > WINDOW) continue;
            if (await say(c, id, to, v, `${o.id}:${id}`)) await mark(id);
          }
        }
      }
      // Signed, not paid
      if (o.signedAt && !o.paidAt) {
        const sg = ts(o.signedAt);
        for (const [id, due] of [["M4.paid2h", sg + 2 * H], ["M4.call24h", sg + D], ["M4.last48h", sg + 2 * D]] as const) {
          if (log[id] || c.now < due || c.now - due > WINDOW) continue;
          if (await say(c, id, to, v, `${o.id}:${id}`)) await mark(id);
        }
      }
    } catch (e) {
      console.error("[vendiora offer]", o.number, e instanceof Error ? e.message : e);
    }
  }
}

// ---------------------------------------------------------------------------
// Clients: M5 follow-ups, onboarding, M6 calls, M7 weekly, M8 DFY, M9 installments, M10, health, upsell
// ---------------------------------------------------------------------------

function weekKey(t: number) {
  const r = rome(t);
  const d = new Date(`${r.day}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const y = d.getUTCFullYear();
  const w = 1 + Math.round((d.getTime() - Date.UTC(y, 0, 4)) / (7 * D) - 3 / 7 + ((new Date(Date.UTC(y, 0, 4)).getUTCDay() + 6) % 7) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

function nextOpenCall(calls: VdCall[]) {
  return calls.filter((x) => x.status !== "fatta").sort((a, b) => a.number - b.number)[0] ?? null;
}

async function runClient(c: Ctx, cl0: VdClient, calls: VdCall[]) {
  let cl = cl0;
  const s = c.s;
  const pkg = playbookPackage(cl.packageCode);
  const ops: ClientOps = { ...cl.ops };
  const sent: Record<string, string> = { ...(ops.sent ?? {}) };
  let dirty = false;
  const nowIso = new Date(c.now).toISOString();
  const once = async (key: string, id: string, vars: Record<string, string>, due: number, window = WINDOW) => {
    if (sent[key] || c.now < due || c.now - due > window) return false;
    if (await say(c, id, target(cl), vars, `${cl.id}:${key}`)) { sent[key] = nowIso; dirty = true; return true; }
    return false;
  };
  const start = ts(ops.activatedAt);
  if (!start || !pkg) return;
  const line = pkg.line;
  const L = s.playbook.links;
  const V = clientVars(s, cl);
  const done = (n: number) => calls.find((x) => x.number === n && x.status === "fatta");
  const call1 = calls.find((x) => x.number === 1);

  await refreshDueDates(cl, calls);

  // ---- M5 timed follow-ups
  const formField = line === "dfy" ? ops.briefAt : ops.intakeAt;
  const form = line === "dfy" ? L.briefForm : L.intakeForm;
  if (!formField && form && call1?.status !== "fatta") {
    await once("M5.form12h", "M5.form12h", { ...V, form }, start + 12 * H);
    await once("M5.form24h", "M5.form24h", { ...V, form }, start + D);
  }
  if (call1 && call1.status === "da_prenotare") {
    await once("M5.personal24h", "M5.personal24h", V, start + D);
    await once("M5.phone48h", "M5.phone48h", V, start + 2 * D);
  }

  // ---- Onboarding: coach (G2), quick win (G3), G7 check
  if (cl.coach) await once("ONB.coach", "ONB.coach", V, start, 30 * D);
  if (call1?.status === "fatta" && !cl.coach) await once("ONB.coachTask", "ONB.coachTask", V, ts(call1.doneAt) || start, 30 * D);
  if (call1?.status === "fatta" && call1.homework && !ops.quickWinAt) {
    if (await once("ONB.quickwin", "ONB.quickwin", { ...V, compiti: call1.homework }, Math.max(ts(call1.doneAt) || start, start + 2 * D), 10 * D)) { ops.quickWinAt = nowIso; }
  }
  if (await once("ONB.g7", "ONB.g7", V, start + 7 * D)) ops.awaiting = { kind: "g7", step: 0, at: nowIso, answers: [] };

  // ---- Calls: calendar alerts + M6
  const pcode = (x: VdCall) => pkg.calls.find((st) => st.n === x.number);
  for (const x of calls) {
    const st = pcode(x);
    const cv = { ...V, call: callLabel(x), scadenza: dShort(x.dueAt), data: dLong(x.scheduledAt), ora: tIt(x.scheduledAt), portare: st?.bring && st.bring !== "—" ? st.bring : "i compiti della settimana", form: L.preCallForm ? `\n\nForm pre-call 👉 ${L.preCallForm}` : "", linkcall: x.meetingUrl ? `\n\nLink della call 👉 ${x.meetingUrl}` : "" };
    const due = ts(x.dueAt);
    if (x.status === "da_prenotare" && due) {
      if (await once(`CAL.due3:${x.id}`, "CAL.due3", cv, due - 3 * D, 3 * D)) await task(c, { key: `${cl.id}:CAL.due3alert:${x.id}`, msgId: "CAL.due3alert", role: line === "dfy" ? "pm" : "coach", vars: cv, clientId: cl.id });
      await once(`CAL.due1:${x.id}`, "CAL.due1", cv, due - D, 2 * D);
      if (c.now > due + 2 * D) await once(`HS.callLate:${x.id}`, "HS.callLate", cv, due + 2 * D, 30 * D);
    }
    if (x.status === "prenotata" && x.scheduledAt) {
      const t = ts(x.scheduledAt);
      const tag = `${x.id}:${x.scheduledAt.slice(0, 16)}`;
      if (t > c.now) {
        await once(`M6.book:${tag}`, "M6.book", cv, c.now - 1, D * 30);
        await once(`M6.t24:${tag}`, "M6.t24", cv, t - D, D - H);
        if (await once(`M6.t1:${tag}`, "M6.t1", cv, t - H, H)) {
          const prev = calls.filter((p) => p.number < x.number && p.status === "fatta").pop();
          await task(c, { key: `${cl.id}:CAL.prep:${tag}`, msgId: "CAL.prep", role: line === "dfy" ? "pm" : "coach", vars: { ...cv, riepilogo: prev?.summary?.slice(0, 1200) || "—", compiti: prev?.homework || "—" }, clientId: cl.id });
        }
      } else if (!x.recordingUrl && !sent[`CAL.noshow:${tag}`]) {
        // With Fathom: no recording 15 min after the start = no-show (message to the client + task).
        // Without Fathom we can't know: only an internal task 2 h after, nothing to the client.
        const fathom = !!c.s.playbook.fathomSecret;
        if (c.now > t + (fathom ? 15 * 60_000 : 2 * H)) {
          if (fathom) await once(`M6.absent:${tag}`, "M6.absent", cv, t + 5 * 60_000, 6 * H);
          if (await task(c, { key: `${cl.id}:CAL.noshow:${tag}`, msgId: "CAL.noshow", role: line === "dfy" ? "pm" : "coach", vars: cv, clientId: cl.id,
            ...(fathom ? {} : { title: `${callLabel(x)}: si è svolta? Segnala fatta o saltata` }) })) {
            sent[`CAL.noshow:${tag}`] = nowIso; dirty = true;
            if (fathom) ops.noShows = (ops.noShows ?? 0) + 1;
          }
        }
      }
    }
    if (x.status === "fatta" && x.doneAt) {
      const dt = ts(x.doneAt);
      const next = calls.filter((n) => n.number > x.number).sort((a, b) => a.number - b.number)[0];
      if (x.summary || x.homework) {
        await once(`M6.recap:${x.id}`, "M6.recap", {
          ...cv, riepilogo: (x.summary || "").slice(0, 1500), compiti: x.homework || "—", scadenza: dShort(x.homeworkAt ?? next?.dueAt ?? null) || "—",
          prossima: next ? callLabel(next) : "—", link: next ? V.link : "",
        }, dt + 2 * H, 3 * D);
      }
      if (next && next.status === "da_prenotare") await once(`M6.rebook2d:${x.id}`, "M6.rebook2d", { ...cv, prossima: callLabel(next) }, dt + 2 * D, 3 * D);
      // homework (M7): day before the deadline at 18:00, then +1 day if not delivered
      if (x.homework && x.homeworkAt && line === "consulenza") {
        const hd = ts(x.homeworkAt);
        await once(`M7.hwDue:${x.id}`, "M7.hwDue", { ...cv, compiti: x.homework, call: next ? callLabel(next) : cv.call }, romeAt(hd, -1, 18), D);
        if (!(x.notes ?? "").includes("[compiti consegnati]")) {
          if (await once(`M7.hwMissed:${x.id}`, "M7.hwMissed", { ...cv, call: next ? callLabel(next) : cv.call }, hd + D, 3 * D)) ops.homeworkMissed = (ops.homeworkMissed ?? 0) + 1;
        }
      }
      // Last call of the package → upsell deal U1 + alert to the sales rep
      if (x.number === pkg.calls.length) {
        const ladder = VALUE_LADDER.filter((l) => l.from.includes(pkg.code)).map((l) => `${l.to} (${l.who.toLowerCase()})`).join("; ");
        if (await once(`CAL.last:${x.id}`, "CAL.last", { ...cv, proposta: ladder, riepilogo: (x.summary || "").slice(0, 1000) }, dt, 30 * D)) {
          ops.upsell = { ...(ops.upsell ?? { stage: "U1", at: nowIso }), stage: ops.upsell && ops.upsell.stage > "U3" ? ops.upsell.stage : "U3", at: nowIso, suggested: ops.upsell?.suggested ?? VALUE_LADDER.find((l) => l.from.includes(pkg.code))?.to ?? null };
        }
      }
    }
  }

  // ---- M7: weekly rhythm (Consulenza) for the length of the package
  const endAt = start + pkg.weeks * 7 * D;
  if (line === "consulenza" && c.now < endAt + D && cl.status !== "concluso") {
    const r = rome(c.now);
    const wk = weekKey(c.now);
    const week = Math.min(pkg.weeks, Math.floor((c.now - start) / (7 * D)) + 1);
    const nc = nextOpenCall(calls);
    const step = pkg.calls.find((st) => st.n === (nc?.number ?? 0));
    const lastDone = calls.filter((x) => x.status === "fatta").pop();
    const focus = step ? `${step.title}: ${step.what}` : "chiudere il percorso";
    if (r.wd === 1 && r.hour >= 9 && r.hour < 13 && c.now > start + 2 * D) await once(`M7.monday:${wk}`, "M7.monday", { ...V, settimana: String(week), focus, compiti: lastDone?.homework || step?.homework || "—" }, c.now - 1);
    if (r.wd === 3 && r.hour >= 18 && r.hour < 21 && c.now > start + 2 * D) await once(`M7.wednesday:${wk}`, "M7.wednesday", V, c.now - 1);
    if (r.wd === 5 && r.hour >= 17 && r.hour < 20 && c.now > start + 4 * D) {
      if (await once(`M7.checkin:${wk}`, "M7.checkin", V, c.now - 1)) ops.awaiting = { kind: "checkin", step: 0, at: nowIso, answers: [] };
    }
    const mid = midpointDays(pkg.code);
    if (mid) {
      if (L.resultsForm) await once("M7.mid", "M7.mid", { ...V, form: L.resultsForm }, start + mid * D, 7 * D);
      if (await once("M7.midCoach", "M7.midCoach", V, start + mid * D, 7 * D)) ops.upsell = ops.upsell ?? { stage: "U1", at: nowIso, readiness: null };
    }
    const chiusura = calls.filter((x) => x.status !== "fatta").map((x) => `• ${callLabel(x)}`).join("\n") || "Le ultime attività del percorso";
    if (await once("M7.end2w", "M7.end2w", { ...V, chiusura, form: L.resultsForm }, endAt - 14 * D, 7 * D)) {
      if (!ops.upsell || ops.upsell.stage < "U2") ops.upsell = { ...(ops.upsell ?? {}), stage: "U2", at: nowIso };
    }
    await once("M7.end1w", "M7.end1w", V, endAt - 7 * D, 7 * D);
  }

  // ---- M8: DFY production deadlines
  if (line === "dfy") {
    const missing = Object.entries(ops.access ?? {}).filter(([, ok]) => !ok).map(([k]) => k);
    const el = missing.map((m) => `• ${m}`).join("\n");
    if (call1?.status === "fatta" && !ops.accessesAt) {
      const req = ts(ops.accessesRequestedAt) || ts(call1.doneAt) || c.now;
      if (!ops.accessesRequestedAt) { ops.accessesRequestedAt = new Date(req).toISOString(); dirty = true; }
      const deadline = req + 3 * D;
      await once("M8.access", "M8.access", { ...V, scadenza: dShort(new Date(deadline).toISOString()), elenco: el || pkg.access.map((a) => `• ${a}`).join("\n") }, req, 3 * D);
      if (missing.length) {
        await once("M8.accessD1", "M8.accessD1", { ...V, elenco: missing.join(", ") }, deadline - D, D);
        await once("M8.accessLate", "M8.accessLate", { ...V, elenco: missing.join(", ") }, deadline + D, 5 * D);
        await once("M8.accessLateCall", "M8.accessLateCall", { ...V, elenco: missing.join(", ") }, deadline + D, 5 * D);
      }
    }
    if (ops.accessesAt) {
      const acc = ts(ops.accessesAt);
      await once("M8.accessOk", "M8.accessOk", { ...V, data: dShort(new Date(acc + 7 * D).toISOString()) }, acc, 3 * D);
      if (!ops.storeReadyAt) await once("M8.progress", "M8.progress", V, acc + 3 * D, 3 * D);
    }
    if (ops.storeReadyAt) await once("M8.ready", "M8.ready", V, ts(ops.storeReadyAt), 5 * D);
    const del = ts(cl.storeLiveAt);
    if (del) {
      await once("M8.d2", "M8.d2", V, del + 2 * D, 3 * D);
      if (pkg.code !== "DFY-S") await once("M8.d13", "M8.d13", V, del + 13 * D, 3 * D);
      await once("M8.d28", "M8.d28", V, del + 28 * D, 3 * D);
      if (pkg.code === "DFY-F") await once("M8.full43", "M8.full43", V, del + 43 * D, 3 * D);
    }
    if (pkg.code === "DFY-F" && ops.adsLaunchedAt) await once("M8.full5", "M8.full5", V, ts(ops.adsLaunchedAt) + 5 * D, 3 * D);
  }

  // ---- M9: installments
  for (const r of ops.installments ?? []) {
    const v9 = { ...V, numero: String(r.n), importo: eur(r.amount), data: dShort(r.dueAt), pagamento: ops.paymentLink ? ` 👉 ${ops.paymentLink}` : "" };
    if (r.status === "da_pagare") await once(`M9.due3:${r.n}`, "M9.due3", v9, ts(r.dueAt) - 3 * D, 3 * D);
    if (r.status === "fallita" && r.failedAt) {
      const f = ts(r.failedAt);
      await once(`M9.fail0:${r.n}`, "M9.fail0", v9, f, 2 * D);
      await once(`M9.fail3:${r.n}`, "M9.fail3", v9, f + 3 * D, 3 * D);
      await once(`M9.fail7:${r.n}`, "M9.fail7", v9, f + 7 * D, 5 * D);
      await once(`M9.fail14call:${r.n}`, "M9.fail14call", v9, f + 13 * D, 3 * D);
      if (await once(`M9.fail14:${r.n}`, "M9.fail14", v9, f + 14 * D, 5 * D)) ops.paymentStatus = "a_rischio";
    }
  }

  // ---- Stage
  const auto = computeStage({ status: cl.status, packageCode: cl.packageCode, contractSignedAt: cl.contractSignedAt, isPaid: cl.isPaid, coach: cl.coach, storeLiveAt: cl.storeLiveAt, ops: { objective: ops.objective, accessesAt: ops.accessesAt, storeReadyAt: ops.storeReadyAt, briefAt: ops.briefAt } }, calls);
  // Stage moved by hand wins until the automatic one catches up (same letter, number >= manual)
  const manual = ops.stageManualAt && cl.stage && /^[OD]\d$/.test(cl.stage) && /^[OD]\d$/.test(auto) && auto[0] === cl.stage[0] && auto < cl.stage;
  const stage = manual ? cl.stage! : auto;
  const patch: Parameters<typeof updateClient>[1] = {};
  if (stage !== cl.stage) patch.stage = stage;
  const closed = stage === "O7" || stage === "D8";
  if (closed && cl.status !== "concluso" && cl.status !== "sospeso" && cl.status !== "rimborsato") patch.status = "concluso";

  // ---- M10: end of path
  if (closed) {
    if (!ops.endAt) { ops.endAt = nowIso; dirty = true; }
    const e = ts(ops.endAt);
    const chiusura = line === "dfy" ? "Ti mandiamo il report finale con i numeri del tuo store." : "Ti mandiamo il certificato di fine percorso.";
    await once("M10.thanks", "M10.thanks", { ...V, chiusura }, e, 3 * D);
    if (L.review) await once("M10.review", "M10.review", { ...V, link: L.review }, e + D, 3 * D);
    if (await once("M10.nps", "M10.nps", V, e + 3 * D, 3 * D)) ops.awaiting = { kind: "nps", step: 0, at: nowIso, answers: [] };
    if (!ops.upsell || ["U1", "U2", "U3"].includes(ops.upsell.stage)) {
      if (await once("M10.upsell7", "M10.upsell7", { ...V, link: L.salesBooking }, e + 7 * D, 3 * D)) ops.upsell = { ...(ops.upsell ?? {}), stage: "U4", at: nowIso };
    }
    const refLink = ops.referralCode ? (L.referral ? `${L.referral}${L.referral.includes("?") ? "&" : "?"}ref=${ops.referralCode}&utm_campaign=REF-${ops.referralCode}` : `${APP_URL}/r/${ops.referralCode}`) : "";
    await once("M10.referral", "M10.referral", { ...V, link: refLink, premio: L.referralReward }, e + 14 * D, 3 * D);
    const slot = Math.floor((c.now - e) / (30 * D));
    if (slot >= 1) await once(`M10.alumni:${slot}`, "M10.alumni", { ...V, link: L.freeContent }, e + slot * 30 * D, 5 * D);
    if (ops.upsell?.stage === "U6") {
      const s60 = Math.floor((c.now - ts(ops.upsell.at)) / (60 * D));
      if (s60 >= 1) await task(c, { key: `${cl.id}:U6:${s60}`, title: "Nurturing upsell: proponi l'offerta", text: `Sono passati ${s60 * 60} giorni dal «non ora» di {nome}: proponi di nuovo il passo successivo (${ops.upsell.suggested ?? "vedi value ladder"}).`, role: "commerciale", vars: V, clientId: cl.id });
    }
  }

  // ---- Health score (consulting and DFY; not for closed / suspended)
  if (!closed && cl.status !== "sospeso" && cl.status !== "rimborsato") {
    const fridays = Object.keys(sent).filter((k) => k.startsWith("M7.checkin:")).map((k) => ts(sent[k])).sort((a, b) => b - a);
    let missed = 0;
    for (const f of fridays) {
      if (c.now - f < 3 * D) continue; // still answering
      const answered = (ops.checkins ?? []).some((ci) => ts(ci.at) >= f && ts(ci.at) < f + 3 * D);
      if (answered) break;
      missed++;
    }
    const callsLate = calls.filter((x) => x.status === "da_prenotare" && x.dueAt && ts(x.dueAt) < c.now).length;
    const accessesLateDays = line === "dfy" && ops.accessesRequestedAt && !ops.accessesAt ? Math.max(0, Math.floor((c.now - ts(ops.accessesRequestedAt) - 3 * D) / D)) : 0;
    const h = computeHealth({
      line, now: c.now, startAt: ops.activatedAt ?? null, checkinsMissed: missed, callsLate, kpi: ops.kpi ?? [], coachVote: ops.coachVote ?? null,
      accessesLateDays, noShows: ops.noShows ?? 0, homeworkMissed: ops.homeworkMissed ?? 0,
      onboardingIncompleteAtG10: c.now > start + 10 * D && (!done(1) || !cl.coach || (line === "consulenza" && !ops.objective)),
    });
    const wk = weekKey(c.now);
    const reasons = h.signals.filter((x) => x.value !== "verde").map((x) => `${x.label}: ${x.detail}`).join("; ") || "—";
    if (h.health !== cl.health || h.score !== cl.healthScore) { patch.health = h.health; patch.healthScore = h.score; }
    ops.healthSignals = h.signals;
    const hist = ops.healthHistory ?? [];
    if (!hist.length || hist[hist.length - 1].health !== h.health || weekKey(ts(hist[hist.length - 1].at)) !== wk) { ops.healthHistory = [...hist, { at: nowIso, health: h.health, score: h.score }]; dirty = true; }
    const hv = { ...V, motivi: reasons };
    // One open health task per client at a time (no pile-up week after week)
    const openKeys = h.health === "verde" ? [] : (await listTasks({ status: "aperto", clientId: cl.id }).catch(() => [])).map((t) => t.key ?? "");
    const hasOpen = (p: string) => openKeys.some((k) => k.startsWith(`${cl.id}:${p}:`));
    if (h.health === "giallo" && !hasOpen("HS.yellow") && !hasOpen("HS.red")) await task(c, { key: `${cl.id}:HS.yellow:${wk}`, msgId: "HS.yellow", role: line === "dfy" ? "pm" : "coach", vars: hv, clientId: cl.id, dueAt: new Date(c.now + 2 * D).toISOString() });
    if (h.health === "rosso") {
      if (!hasOpen("HS.red")) await task(c, { key: `${cl.id}:HS.red:${wk}`, msgId: "HS.red", vars: hv, clientId: cl.id, dueAt: new Date(c.now + D).toISOString(), urgent: true });
      const redSince = [...(ops.healthHistory ?? [])].reverse().findIndex((x) => x.health !== "rosso");
      const series = ops.healthHistory ?? [];
      const firstRed = redSince === -1 ? series[0] : series[series.length - redSince];
      if (firstRed && c.now - ts(firstRed.at) >= 14 * D && !hasOpen("HS.ceo")) await task(c, { key: `${cl.id}:HS.ceo:${wk}`, msgId: "HS.ceo", vars: hv, clientId: cl.id, urgent: true });
    }
    dirty = true;
  }

  ops.sent = sent;
  if (dirty || Object.keys(patch).length) {
    cl = await updateClient(cl.id, { ...patch, ops: { ...cl.ops, ...ops } });
  }
}

async function runClients(c: Ctx) {
  const clients = await listClients();
  const allCalls = await listCalls();
  for (const cl of clients) {
    if (cl.status === "sospeso" || cl.status === "rimborsato") continue;
    if (!cl.ops.activatedAt) {
      if (cl.isPaid && cl.packageCode) await activateClient(cl.id, { s: c.s, now: c.now });
      continue;
    }
    try {
      await runClient(c, cl, allCalls.filter((x) => x.clientId === cl.id).sort((a, b) => a.number - b.number));
    } catch (e) {
      console.error("[vendiora client]", cl.id, e instanceof Error ? e.message : e);
    }
  }
}

/** Only the sales part (used 3 minutes after a lead arrives) */
export async function runPlaybookSales(): Promise<Record<string, number>> {
  const s = await getSettings();
  const c: Ctx = { s, now: Date.now(), out: {} };
  if (s.playbook.enabled) await runSales(c);
  return c.out;
}

export async function runPlaybook(now = Date.now()): Promise<Record<string, number>> {
  const s = await getSettings();
  const c: Ctx = { s, now, out: {} };
  if (!s.playbook.enabled) return c.out;
  await runSales(c).catch((e) => console.error("[vendiora sales]", e instanceof Error ? e.message : e));
  await runOffers(c).catch((e) => console.error("[vendiora offers]", e instanceof Error ? e.message : e));
  await runClients(c).catch((e) => console.error("[vendiora clients]", e instanceof Error ? e.message : e));
  return c.out;
}

// ---------------------------------------------------------------------------
// Inbound from a client: check-in answers, G7 vote, NPS
// ---------------------------------------------------------------------------

const num = (t: string) => {
  const m = /-?\d+(?:[.,]\d+)?/.exec(t.replace(/\./g, "").replace(/(\d),(\d)/, "$1.$2"));
  return m ? Number(m[0].replace(",", ".")) : null;
};

export async function clientInbound(cl: VdClient, text: string, at: string): Promise<string | null> {
  const a = cl.ops.awaiting;
  if (!a || Date.now() - ts(a.at) > 4 * D) return null;
  const s = await getSettings();
  const c: Ctx = { s, now: Date.now(), out: {} };
  const V = clientVars(s, cl);
  const ops: ClientOps = { ...cl.ops };
  if (a.kind === "checkin") {
    const answers = [...a.answers, text];
    if (answers.length < 3) {
      ops.awaiting = { ...a, step: answers.length, answers };
      await updateClient(cl.id, { ops });
      const id = answers.length === 1 ? "M7.checkin2" : "M7.checkin3";
      await say(c, id, target(cl), V, `${cl.id}:${id}:${a.at}`);
      return "checkin-next";
    }
    ops.awaiting = null;
    ops.checkins = [...(ops.checkins ?? []), { at, answers }];
    const k = num(answers[1]);
    if (k != null) ops.kpi = [...(ops.kpi ?? []), { at, value: k }];
    await updateClient(cl.id, { ops });
    await say(c, "M7.checkinThanks", target(cl), V, `${cl.id}:M7.checkinThanks:${a.at}`);
    return "checkin-done";
  }
  const n = num(text);
  if (n == null) return null;
  if (a.kind === "g7") {
    ops.awaiting = null;
    ops.g7Vote = Math.max(1, Math.min(10, Math.round(n)));
    await updateClient(cl.id, { ops });
    if (ops.g7Vote <= 7) await say(c, "ONB.g7low", target(cl), { ...V, voto: String(ops.g7Vote) }, `${cl.id}:ONB.g7low`);
    return "g7";
  }
  ops.awaiting = null;
  ops.nps = Math.max(0, Math.min(10, Math.round(n)));
  ops.npsAt = at;
  await updateClient(cl.id, { ops });
  if (ops.nps <= 6) await task(c, { key: `${cl.id}:nps-low`, title: "NPS basso", text: `{nome} ha dato ${ops.nps}/10 di NPS: chiamalo per capire cosa non è andato.`, role: "csm", vars: V, clientId: cl.id });
  return "nps";
}

// ---------------------------------------------------------------------------
// Fathom (native webhook or Zapier/Make): summary + homework on the right call, sale recorded for SALES-CALL
// ---------------------------------------------------------------------------

export interface FathomPayload {
  title: string;
  emails: string[];
  summary: string | null;
  actionItems: string[];
  transcript: string | null;
  recordingUrl: string | null;
  startedAt: string | null;
}

export function parseFathom(b: Record<string, unknown>): FathomPayload {
  const g = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : null);
  const invitees = (Array.isArray(b.calendar_invitees) ? b.calendar_invitees : Array.isArray(b.invitees) ? b.invitees : []) as Record<string, unknown>[];
  const emails = [
    ...invitees.filter((i) => i && i.is_external !== false).map((i) => String(i.email ?? "")),
    ...(typeof b.email === "string" ? [b.email] : []),
    ...(Array.isArray(b.emails) ? (b.emails as unknown[]).map(String) : []),
  ].map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
  const sum = b.default_summary as Record<string, unknown> | string | undefined;
  const summary = typeof sum === "string" ? sum : typeof sum?.markdown_formatted === "string" ? (sum.markdown_formatted as string) : g("summary");
  const ai = (Array.isArray(b.action_items) ? b.action_items : []) as (Record<string, unknown> | string)[];
  const actionItems = ai.map((x) => (typeof x === "string" ? x : String(x.description ?? x.text ?? ""))).filter(Boolean);
  const tr = b.transcript;
  const transcript = typeof tr === "string" ? tr : Array.isArray(tr) ? (tr as Record<string, unknown>[]).map((t) => `${(t.speaker as Record<string, unknown>)?.display_name ?? ""}: ${t.text ?? ""}`).join("\n") : null;
  return {
    title: g("meeting_title") || g("title") || "",
    emails,
    summary: summary ? summary.slice(0, 19000) : null,
    actionItems,
    transcript: transcript ? transcript.slice(0, 50000) : null,
    recordingUrl: g("share_url") || g("url") || g("recording_url"),
    startedAt: g("recording_start_time") || g("scheduled_start_time") || g("created_at"),
  };
}

async function fathomToCall(cl: VdClient, call: VdCall, p: FathomPayload, at: string, homework: string | null): Promise<{ matched: string; id?: string }> {
  // Same call recorded by two team members' Fathom accounts: keep the first recording
  if (call.status === "fatta" && call.recordingUrl && call.recordingUrl !== p.recordingUrl && call.doneAt && Math.abs(Date.parse(call.doneAt) - Date.parse(at)) < 3 * H) {
    return { matched: "duplicate", id: call.id };
  }
  const next = (await listCalls({ clientId: cl.id })).find((x) => x.number === call.number + 1);
  const hwAt = next?.dueAt ? new Date(Date.parse(next.dueAt) - D).toISOString() : new Date(Date.parse(at) + 6 * D).toISOString();
  await updateCall(call.id, {
    status: "fatta", doneAt: call.doneAt ?? at, summary: p.summary, homework: homework?.slice(0, 3900) ?? call.homework ?? null, homeworkAt: homework ? hwAt : call.homeworkAt ?? null,
    recordingUrl: p.recordingUrl, notes: [call.notes, p.transcript ? `Trascrizione Fathom disponibile (${p.transcript.length} caratteri)` : null].filter(Boolean).join("\n\n").slice(0, 3900),
  });
  if (cl.leadId) await addLeadEvent({ leadId: cl.leadId, type: "note", outcome: null, fromStatus: null, toStatus: null, note: `Fathom · ${call.title}\n\n${(p.summary ?? "").slice(0, 3000)}${p.recordingUrl ? `\n\nRegistrazione: ${p.recordingUrl}` : ""}`, actorId: null, actorName: "Fathom" }).catch(() => {});
  return { matched: "call", id: call.id };
}

export async function ingestFathom(p: FathomPayload): Promise<{ matched: string; id?: string }> {
  const code = /\b(BASE|ELITE|DFY-SA|DFY-S|DFY-F)-C(\d{1,2})\b/i.exec(p.title);
  const sales = /\bSALES-CALL\b/i.test(p.title);
  const homework = p.actionItems.join("\n") || /compit[io][^\n]*\n([\s\S]{0,800})/i.exec(p.summary ?? "")?.[1]?.trim() || null;
  const at = p.startedAt && Number.isFinite(Date.parse(p.startedAt)) ? new Date(p.startedAt).toISOString() : new Date().toISOString();
  if (code && !sales) {
    const pkgCode = code[1].toUpperCase();
    const n = Number(code[2]);
    const clients = (await listClients()).filter((x) => x.email && p.emails.includes(x.email.toLowerCase()));
    const nameHint = p.title.split(/[–-]\s*/).pop()?.trim().toLowerCase();
    const cl = clients.find((x) => x.packageCode === pkgCode) ?? clients[0] ?? (nameHint ? (await listClients()).find((x) => x.name.toLowerCase() === nameHint) : undefined);
    if (!cl) return { matched: "client-not-found" };
    const call = (await listCalls({ clientId: cl.id })).find((x) => x.number === n);
    if (!call) return { matched: "call-not-found" };
    return fathomToCall(cl, call, p, at, homework);
  }
  // No code in the title (e.g. calls booked on Cal.com): the client's call scheduled closest to the recording
  if (!sales && p.emails.length) {
    const t = Date.parse(at);
    for (const cl of (await listClients()).filter((x) => x.email && p.emails.includes(x.email.toLowerCase()))) {
      const hit = (await listCalls({ clientId: cl.id }))
        .filter((x) => x.scheduledAt && Math.abs(Date.parse(x.scheduledAt) - t) < 3 * H)
        .sort((x, y) => Math.abs(Date.parse(x.scheduledAt!) - t) - Math.abs(Date.parse(y.scheduledAt!) - t))[0];
      if (hit) return fathomToCall(cl, hit, p, at, homework);
    }
  }
  // Sales call: summary on the lead + call recorded
  const leads = (await listLeads({ max: 3000 })).filter((l) => l.email && p.emails.includes(l.email.toLowerCase()));
  const lead = leads[0];
  if (!lead) return { matched: "lead-not-found" };
  if (lead.lastContactAt && lead.nextActionNote?.startsWith("Call svolta (Fathom)") && Math.abs(Date.parse(lead.lastContactAt) - Date.parse(at)) < 3 * H) {
    return { matched: "duplicate", id: lead.id };
  }
  await addLeadEvent({
    leadId: lead.id, type: "call", outcome: null, fromStatus: null, toStatus: null,
    note: `Call di vendita registrata da Fathom (${dLong(at)} ${tIt(at)})\n\n${(p.summary ?? "").slice(0, 3500)}${p.actionItems.length ? `\n\nAction item:\n${p.actionItems.map((x) => `• ${x}`).join("\n")}` : ""}${p.recordingUrl ? `\n\nRegistrazione: ${p.recordingUrl}` : ""}`,
    actorId: null, actorName: "Fathom",
  });
  await updateLead(lead.id, { lastContactAt: at, nextActionNote: "Call svolta (Fathom): esito da registrare", status: lead.status === "appuntamento" ? "proposta" : lead.status });
  return { matched: "lead", id: lead.id };
}

export { CONTINUOUS_SERVICES };
