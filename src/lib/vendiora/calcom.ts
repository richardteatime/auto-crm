// Cal.com → CRM. One webhook (Cal.com → Settings → Developer → Webhooks) keeps the CRM calendar in sync:
//  • BOOKING_CREATED / BOOKING_RESCHEDULED: the client's call becomes "prenotata" with date + video link
//    (then M6 confirmation, T−24 h, T−1 h with the link, coach alert run from the cron); a lead's
//    sales call sets the lead to "appuntamento" (M2 sequence). Someone booking without being in the
//    CRM becomes a new lead (source Cal.com).
//  • BOOKING_CANCELLED: call back to "da prenotare" (deadline reminders restart) + task to the team.
//  • BOOKING_NO_SHOW_UPDATED / AFTER_GUESTS_CAL_VIDEO_NO_SHOW: no-show handled like the playbook says.
// Matching: metadata[crm] from our personalised links → booking uid → attendee email.

import { addLeadEvent, getLead, listLeads, updateLead } from "@/lib/db/leads";
import { createNotification } from "@/lib/db/notifications";
import { ingestLead } from "@/lib/leads/service";
import { APP_URL, sendPush } from "@/lib/leads/notify";
import { getClient, getConversationByLead, getSettings, listCalls, listClients, patchClientOps, saveConversation, updateCall } from "@/lib/vendiora/db";
import { salesNoShow, task, teamIds } from "@/lib/vendiora/engine";
import { parseCalRef } from "@/lib/vendiora/cal-links";
import type { TaskRole, VdCall, VdClient, VendioraSettings } from "@/lib/vendiora/types";
import { playbookPackage } from "@/lib/vendiora/playbook";
import type { Lead } from "@/lib/leads/types";

type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export interface CalEvent {
  trigger: string;
  uid: string | null;
  previousUid: string | null;
  start: string | null;
  title: string;
  eventType: string;
  meetingUrl: string | null;
  ref: ReturnType<typeof parseCalRef>;
  attendees: { name: string; email: string | null; phone: string | null; noShow: boolean }[];
  cancelReason: string | null;
  /** Pre-call form answers (custom booking questions), "Domanda: risposta" */
  answers: string[];
}

const DEFAULT_FIELDS = new Set(["name", "email", "location", "attendeePhoneNumber", "title", "notes", "guests", "rescheduleReason"]);

export function parseCal(body: unknown): CalEvent {
  const b = obj(body);
  const p = obj(b.payload);
  const meta = obj(p.metadata);
  const resp = obj(p.responses);
  const respVal = (k: string) => str(obj(resp[k]).value) ?? str(resp[k]);
  const loc = str(p.location);
  const video = str(meta.videoCallUrl) ?? str(obj(p.videoCallData).url) ?? (loc && /^https?:\/\//.test(loc) ? loc : null);
  const att = Array.isArray(p.attendees) ? p.attendees.map(obj) : [];
  const start = str(p.startTime);
  return {
    trigger: String(b.triggerEvent ?? p.triggerEvent ?? "").toUpperCase(),
    uid: str(p.uid) ?? str(p.bookingUid),
    previousUid: str(p.rescheduleUid) ?? str(p.fromReschedule) ?? str(p.rescheduledFromUid),
    start: start && Number.isFinite(Date.parse(start)) ? new Date(start).toISOString() : null,
    title: str(p.title) ?? str(p.eventTitle) ?? "",
    eventType: str(p.type) ?? str(obj(p.eventType).slug) ?? "",
    meetingUrl: video && /^https?:\/\//.test(video) ? video.slice(0, 1000) : null,
    ref: parseCalRef(meta.crm ?? obj(p.bookingMetadata).crm),
    attendees: att.map((a) => ({
      name: str(a.name) ?? "",
      email: str(a.email)?.toLowerCase() ?? null,
      phone: str(a.phoneNumber) ?? null,
      noShow: a.noShow === true,
    })).concat(att.length ? [] : [{ name: respVal("name") ?? "", email: respVal("email")?.toLowerCase() ?? null, phone: respVal("attendeePhoneNumber"), noShow: false }]),
    cancelReason: str(p.cancellationReason),
    answers: Object.entries(resp)
      .filter(([k, v]) => !DEFAULT_FIELDS.has(k) || (k === "notes" && str(obj(v).value)))
      .map(([k, v]) => {
        const o = obj(v);
        const val = o.value ?? v;
        const text = Array.isArray(val) ? val.join(", ") : typeof val === "string" || typeof val === "number" || typeof val === "boolean" ? String(val) : "";
        const label = str(o.label);
        return text.trim() ? `${label && !/^[a-z_]+$/.test(label) ? label : k}: ${text.trim()}` : "";
      })
      .filter(Boolean)
      .slice(0, 12),
  };
}

const CODE = /\b(BASE|ELITE|DFY-SA|DFY-S|DFY-F)-C(\d{1,2})\b/i;
const dt = (iso: string) => new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function notifyTeam(s: VendioraSettings, role: TaskRole, title: string, body: string, url: string, related: { leadId?: string | null }) {
  const ids = teamIds(s, role);
  await sendPush({ title, body: body.slice(0, 160), url, tag: `cal-${title}` }, ids.length ? ids : undefined).catch(() => 0);
  for (const userId of ids) {
    await createNotification({ userId, type: "lead_whatsapp", title, body: body.slice(0, 400), relatedId: related.leadId ?? null, relatedType: related.leadId ? "lead" : null, fromUserName: "Cal.com" }).catch(() => {});
  }
}

/** Which client call a booking is for: same booking uid → number from the ref / event title → next open call */
function pickCall(calls: VdCall[], e: CalEvent): VdCall | null {
  const byUid = calls.find((x) => x.calUid && (x.calUid === e.uid || x.calUid === e.previousUid));
  if (byUid) return byUid;
  const n = e.ref?.n ?? Number(CODE.exec(`${e.title} ${e.eventType}`)?.[2] ?? 0);
  if (n) return calls.find((x) => x.number === n) ?? null;
  return calls.filter((x) => x.status !== "fatta" && !(x.status === "prenotata" && x.calUid)).sort((a, b) => a.number - b.number)[0] ?? null;
}

async function findTarget(e: CalEvent): Promise<{ client?: VdClient; lead?: Lead }> {
  if (e.ref?.kind === "client") { const cl = await getClient(e.ref.id).catch(() => null); if (cl) return { client: cl }; }
  if (e.ref?.kind === "lead") { const l = await getLead(e.ref.id).catch(() => null); if (l) return { lead: l }; }
  const clients = await listClients();
  if (e.uid || e.previousUid) {
    const all = await listCalls();
    const hit = all.find((x) => x.calUid && (x.calUid === e.uid || x.calUid === e.previousUid));
    const cl = hit && clients.find((c) => c.id === hit.clientId);
    if (cl) return { client: cl };
  }
  const emails = e.attendees.map((a) => a.email).filter((x): x is string => !!x);
  if (!emails.length) return {};
  const cl = clients.filter((c) => c.email && emails.includes(c.email.toLowerCase()) && !["concluso", "rimborsato"].includes(c.status)).pop();
  // A known client booking a "vendita" event is still a client call only if the event isn't the sales one
  if (cl && !/vendit|sales|scoperta|strategic/i.test(`${e.eventType} ${e.title}`)) return { client: cl };
  const lead = (await listLeads({ max: 3000 })).find((l) => l.email && emails.includes(l.email.toLowerCase()));
  if (lead) return { lead };
  return cl ? { client: cl } : {};
}

export async function ingestCal(e: CalEvent): Promise<{ matched: string; id?: string }> {
  if (e.trigger === "PING") return { matched: "ping" };
  const s = await getSettings();
  const booked = e.trigger === "BOOKING_CREATED" || e.trigger === "BOOKING_RESCHEDULED";
  const cancelled = e.trigger === "BOOKING_CANCELLED" || e.trigger === "BOOKING_REJECTED";
  const noShow = e.trigger === "AFTER_GUESTS_CAL_VIDEO_NO_SHOW" || (e.trigger === "BOOKING_NO_SHOW_UPDATED" && e.attendees.some((a) => a.noShow));
  if (!booked && !cancelled && !noShow) return { matched: "ignored" };

  const found = await findTarget(e);
  const client = found.client;
  let lead = found.lead;

  // Unknown person booking from a public link (site, bio, ads): becomes a lead, sales call already booked
  if (!client && !lead && booked && e.uid) {
    const a = e.attendees[0];
    if (!a?.email && !a?.phone) return { matched: "no-attendee" };
    const r = await ingestLead({
      externalId: `calcom:${e.uid}`, name: a.name || null, phone: a.phone ?? "", email: a.email, company: null, service: e.title || null,
      context: { form: `Cal.com · ${e.eventType || e.title}`, platform: "calcom" },
      formData: Object.fromEntries(e.answers.map((x) => { const i = x.indexOf(": "); return [x.slice(0, i), x.slice(i + 2)]; })),
    } as Parameters<typeof ingestLead>[0], "calcom", { notify: false });
    lead = r.lead;
  }

  // ---------------------------------------------------------------- client calls
  if (client) {
    const cl = client;
    const pkg = playbookPackage(cl.packageCode);
    const role: TaskRole = pkg?.line === "dfy" ? "pm" : "coach";
    const calls = await listCalls({ clientId: cl.id });
    const call = pickCall(calls, e);
    if (!call) return { matched: "client-call-not-found", id: cl.id };
    const url = `${APP_URL}/vendiora/clienti/${cl.id}`;
    if (booked && e.start) {
      const pre = e.answers.length ? `Form pre-call (${dt(e.start)}):\n${e.answers.join("\n")}` : null;
      const notes = pre && !(call.notes ?? "").includes(pre) ? [call.notes, pre].filter(Boolean).join("\n\n").slice(0, 3900) : call.notes;
      await updateCall(call.id, { status: "prenotata", scheduledAt: e.start, calUid: e.uid, meetingUrl: e.meetingUrl ?? call.meetingUrl ?? null, doneAt: null, notes });
      const what = e.trigger === "BOOKING_RESCHEDULED" ? "ha spostato" : "ha prenotato";
      await notifyTeam(s, role, `📅 ${cl.name} ${what} la call`, `${call.title} · ${dt(e.start)}`, url, { leadId: cl.leadId });
      return { matched: "client-call", id: call.id };
    }
    if (cancelled) {
      if (call.calUid && call.calUid !== e.uid) return { matched: "stale-cancel", id: call.id };
      await updateCall(call.id, { status: "da_prenotare", scheduledAt: null, calUid: null, meetingUrl: null });
      await task({ s, now: Date.now(), out: {} }, {
        key: `${cl.id}:CALCOM.cancel:${e.uid}`, role, clientId: cl.id, vars: { nome: cl.name.split(" ")[0], nomecompleto: cl.name },
        title: "Call annullata dal cliente", text: `${cl.name} ha annullato ${call.title}${e.cancelReason ? ` (motivo: ${e.cancelReason})` : ""}. Il CRM gli ricorderà di riprenotare prima della scadenza; se serve, chiamalo.`,
      });
      return { matched: "client-cancel", id: call.id };
    }
    if (noShow && call.status === "prenotata") {
      const when = call.scheduledAt ? dt(call.scheduledAt) : "";
      await updateCall(call.id, { status: "da_prenotare", scheduledAt: null, calUid: null, meetingUrl: null, notes: [call.notes, `No-show ${when} (Cal.com)`].filter(Boolean).join("\n").slice(0, 3900) });
      await patchClientOps(cl.id, { noShows: (cl.ops.noShows ?? 0) + 1 });
      await task({ s, now: Date.now(), out: {} }, {
        key: `${cl.id}:CALCOM.noshow:${e.uid}`, role, clientId: cl.id, urgent: true, vars: { nome: cl.name.split(" ")[0], nomecompleto: cl.name },
        title: "No-show alla call", text: `${cl.name} non si è presentato a ${call.title} (${when}), segnalato da Cal.com. Contattalo: la call torna da prenotare e partono i promemoria.`,
      });
      return { matched: "client-noshow", id: call.id };
    }
    return { matched: "client-noop", id: call.id };
  }

  // ---------------------------------------------------------------- sales call (lead)
  if (lead) {
    const url = `${APP_URL}/leads/${lead.id}`;
    const conv = await getConversationByLead(lead.id).catch(() => null);
    if (booked && e.start) {
      const prev = lead.status;
      await updateLead(lead.id, { status: "appuntamento", nextActionAt: e.start, nextActionNote: `Call di vendita (Cal.com) ${dt(e.start)}` });
      await addLeadEvent({
        leadId: lead.id, type: "status", outcome: null, fromStatus: prev, toStatus: "appuntamento",
        note: `${e.trigger === "BOOKING_RESCHEDULED" ? "Call spostata" : "Call prenotata"} su Cal.com: ${dt(e.start)}${e.meetingUrl ? `\nLink: ${e.meetingUrl}` : ""}${e.answers.length ? `\n\nForm pre-call:\n${e.answers.join("\n")}` : ""}`.slice(0, 3900),
        actorId: null, actorName: "Cal.com",
      }).catch(() => {});
      if (conv) {
        const tag = e.start.slice(0, 16);
        await saveConversation({ ...conv, seqLog: { ...(conv.seqLog ?? {}), [`calUid:${tag}`]: e.uid ?? "", ...(e.meetingUrl ? { [`calMeet:${tag}`]: e.meetingUrl } : {}) } });
      }
      await notifyTeam(s, "commerciale", `📅 ${lead.name}: call di vendita prenotata`, dt(e.start), url, { leadId: lead.id });
      return { matched: "lead-booked", id: lead.id };
    }
    if (cancelled) {
      if (lead.status === "appuntamento") await updateLead(lead.id, { status: "da_richiamare", nextActionAt: new Date().toISOString(), nextActionNote: "Ha annullato la call su Cal.com: richiamalo" });
      await addLeadEvent({ leadId: lead.id, type: "status", outcome: null, fromStatus: lead.status, toStatus: lead.status === "appuntamento" ? "da_richiamare" : lead.status, note: `Call annullata su Cal.com${e.cancelReason ? `: ${e.cancelReason}` : ""}`, actorId: null, actorName: "Cal.com" }).catch(() => {});
      await notifyTeam(s, "commerciale", `❌ ${lead.name} ha annullato la call`, e.cancelReason ?? "Richiamalo per riprenotare", url, { leadId: lead.id });
      return { matched: "lead-cancel", id: lead.id };
    }
    if (noShow) {
      const k = `calNoShow:${e.uid}`;
      if (conv?.seqLog?.[k]) return { matched: "lead-noshow-dup", id: lead.id };
      await salesNoShow(lead);
      const c2 = await getConversationByLead(lead.id).catch(() => null);
      if (c2) await saveConversation({ ...c2, seqLog: { ...(c2.seqLog ?? {}), [k]: new Date().toISOString() } });
      return { matched: "lead-noshow", id: lead.id };
    }
  }
  return { matched: "not-found" };
}
