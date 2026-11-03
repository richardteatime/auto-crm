import webpush from "web-push";
import nodemailer from "nodemailer";
import { users } from "@/lib/appwrite";
import { Query } from "@/lib/query17";
import {
  listLeads,
  listPushSubscriptions,
  deletePushSubscriptionById,
  updateLead,
} from "@/lib/db/leads";
import { LEAD_STATUS_CONFIG, LEAD_SOURCE_LABELS, type Lead } from "@/lib/leads/types";
import { roleFromLabels } from "@/lib/roles";
import { TIME_ZONE } from "@/lib/dates";

// New-lead alerts: web push on the devices where someone turned notifications on,
// plus an email backup. A periodic check escalates leads nobody called and
// reminds the salesperson of due call-backs.

const APP_URL = (process.env.APP_URL || "https://crm.app.easlydev.online").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Web push
// ---------------------------------------------------------------------------

let vapidReady = false;
function initVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:info@sarconx.com", pub, priv);
  vapidReady = true;
  return true;
}

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Sends to the given users' devices (all devices when userIds is undefined). Returns delivered count. */
export async function sendPush(payload: PushPayload, userIds?: string[]): Promise<number> {
  if (!initVapid()) return 0;
  if (userIds && userIds.length === 0) return 0;
  const subs = await listPushSubscriptions(userIds);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 6, urgency: "high" }
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // The browser dropped the subscription: forget it
        if (code === 404 || code === 410) await deletePushSubscriptionById(s.id);
        else console.error("[push]", code, (e as Error).message);
      }
    })
  );
  return sent;
}

// ---------------------------------------------------------------------------
// Email (SMTP of sarconx.com)
// ---------------------------------------------------------------------------

function mailer() {
  const pass = process.env.SMTP_PASS;
  if (!pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "mail.sarconx.com",
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER || "noreply@sarconx.com", pass },
  });
}

const emailList = (v: string | undefined) =>
  (v || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));

async function sendMail(to: string[], subject: string, html: string, text: string) {
  const t = mailer();
  if (!t || to.length === 0) return false;
  try {
    await t.sendMail({
      from: `SarconX CRM <${process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@sarconx.com"}>`,
      to: to.join(", "),
      subject,
      html,
      text,
    });
    return true;
  } catch (e) {
    console.error("[mail]", (e as Error).message);
    return false;
  }
}

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function leadSummary(lead: Lead): string {
  return [lead.company, lead.service].filter(Boolean).join(" · ") || LEAD_SOURCE_LABELS[lead.source] || "Nuovo contatto";
}

// ---------------------------------------------------------------------------
// Users by role
// ---------------------------------------------------------------------------

async function userIdsByRole(): Promise<{ sales: string[]; admins: string[]; adminEmails: string[] }> {
  const res = await users.list([Query.limit(100)]);
  const sales: string[] = [];
  const admins: string[] = [];
  const adminEmails: string[] = [];
  for (const u of res.users) {
    if (roleFromLabels(u.labels) === "commerciale") sales.push(u.$id);
    else {
      admins.push(u.$id);
      if (u.email) adminEmails.push(u.email);
    }
  }
  return { sales, admins, adminEmails };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function notifyNewLead(lead: Lead): Promise<void> {
  const url = `${APP_URL}/leads/${lead.id}`;
  const summary = leadSummary(lead);
  await Promise.allSettled([
    sendPush({ title: `Nuovo lead: ${lead.name}`, body: `${summary}\nTocca per aprire e chiamare`, url: `/leads/${lead.id}`, tag: `lead-${lead.id}` }),
    sendMail(
      emailList(process.env.LEAD_ALERT_EMAILS),
      `Nuovo lead: ${lead.name}${lead.company ? ` (${lead.company})` : ""}`,
      `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">
        <p style="margin:0 0 8px"><strong>${esc(lead.name)}</strong>${lead.company ? ` · ${esc(lead.company)}` : ""}</p>
        ${lead.service ? `<p style="margin:0 0 8px">Interesse: ${esc(lead.service)}</p>` : ""}
        ${lead.phone ? `<p style="margin:0 0 8px">Telefono: <a href="tel:${esc(lead.phoneE164 || lead.phone)}">${esc(lead.phone)}</a></p>` : ""}
        ${lead.email ? `<p style="margin:0 0 8px">Email: ${esc(lead.email)}</p>` : ""}
        ${lead.campaign ? `<p style="margin:0 0 8px;color:#666">Campagna: ${esc(lead.campaign)}</p>` : ""}
        <p style="margin:16px 0"><a href="${url}" style="background:#c2410c;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Apri il lead nel CRM</a></p>
      </div>`,
      `Nuovo lead: ${lead.name}\n${summary}\nTelefono: ${lead.phone ?? "-"}\n${url}`
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Working hours (Europe/Rome). LEAD_WORK_HOURS="1-5 09:00-19:00" (days 1=Mon … 7=Sun)
// ---------------------------------------------------------------------------

function parseHours() {
  const raw = process.env.LEAD_WORK_HOURS || "1-5 09:00-19:00";
  const m = raw.match(/^(\d)-(\d)\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!m) return { d0: 1, d1: 5, start: 9 * 60, end: 19 * 60 };
  return { d0: +m[1], d1: +m[2], start: +m[3] * 60 + +m[4], end: +m[5] * 60 + +m[6] };
}

const romeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function romeClock(ms: number) {
  const p = Object.fromEntries(romeFmt.formatToParts(ms).map((x) => [x.type, x.value]));
  return { dow: DOW[p.weekday] ?? 1, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function isWorkingTime(ms: number): boolean {
  const h = parseHours();
  const { dow, minutes } = romeClock(ms);
  return dow >= h.d0 && dow <= h.d1 && minutes >= h.start && minutes < h.end;
}

/** Minutes of working time the lead has waited today (leads from the night count from opening time) */
export function workingMinutesWaited(createdMs: number, nowMs: number): number {
  if (!isWorkingTime(nowMs)) return 0;
  const h = parseHours();
  const { minutes } = romeClock(nowMs);
  const openedMs = nowMs - (minutes - h.start) * 60_000;
  return Math.max(0, Math.floor((nowMs - Math.max(createdMs, openedMs)) / 60_000));
}

// ---------------------------------------------------------------------------
// Periodic check (every few minutes, single instance: LEAD_CRON_ENABLED=1)
// ---------------------------------------------------------------------------

export async function runLeadChecks(nowMs = Date.now()): Promise<{ escalated: number; reminded: number }> {
  const escalateAfter = Number(process.env.LEAD_ESCALATE_MINUTES || 15);
  const open = await listLeads({ statuses: ["nuovo", "da_richiamare", "appuntamento", "proposta"], max: 1000 });
  const roles = await userIdsByRole();
  let escalated = 0;
  let reminded = 0;

  // 1) New leads nobody called within N working minutes → founders
  for (const lead of open) {
    if (lead.status !== "nuovo" || lead.firstContactAt || lead.escalatedAt) continue;
    const waited = workingMinutesWaited(Date.parse(lead.createdAt), nowMs);
    if (waited < escalateAfter) continue;
    await updateLead(lead.id, { escalatedAt: new Date(nowMs).toISOString() });
    escalated++;
    const url = `${APP_URL}/leads/${lead.id}`;
    await Promise.allSettled([
      sendPush(
        { title: `Lead in attesa da ${waited} min`, body: `${lead.name} · ${leadSummary(lead)} non è ancora stato chiamato`, url: `/leads/${lead.id}`, tag: `esc-${lead.id}` },
        [...roles.admins, ...roles.sales]
      ),
      sendMail(
        emailList(process.env.LEAD_ESCALATION_EMAILS).length ? emailList(process.env.LEAD_ESCALATION_EMAILS) : roles.adminEmails,
        `Lead non ancora chiamato: ${lead.name}`,
        `<p style="font-family:system-ui,sans-serif">${esc(lead.name)} (${esc(leadSummary(lead))}) aspetta da ${waited} minuti lavorativi.<br><a href="${url}">Apri il lead</a></p>`,
        `${lead.name} aspetta da ${waited} minuti lavorativi. ${url}`
      ),
    ]);
  }

  // 2) Call-backs that are due now → the salesperson
  const twelveHours = 12 * 60 * 60_000;
  for (const lead of open) {
    if (!lead.nextActionAt) continue;
    const due = Date.parse(lead.nextActionAt);
    if (due > nowMs || nowMs - due > twelveHours) continue;
    if (lead.remindedAt && Date.parse(lead.remindedAt) >= due) continue;
    await updateLead(lead.id, { remindedAt: new Date(nowMs).toISOString() });
    reminded++;
    const targets = lead.assignedTo ? [lead.assignedTo] : roles.sales.length ? roles.sales : roles.admins;
    await sendPush(
      {
        title: `${LEAD_STATUS_CONFIG[lead.status].label}: ${lead.name}`,
        body: lead.nextActionNote || `È ora di richiamare ${lead.name}`,
        url: `/leads/${lead.id}`,
        tag: `due-${lead.id}`,
      },
      targets
    ).catch(() => 0);
  }

  return { escalated, reminded };
}
