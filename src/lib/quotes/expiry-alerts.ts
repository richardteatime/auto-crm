// Quote expiry alerts: QUOTE_WARN_DAYS before a quote's validUntil date ("pre")
// and on the day it expires ("due"), if it isn't paid yet, every admin of this
// CRM gets a bell notification, a push and an e-mail. quotes.expiryAlert keeps
// the last stage sent, so each stage goes out once; changing the date resets it.

import { users } from "@/lib/appwrite";
import { Query } from "@/lib/query17";
import { listQuotes, updateQuote, type Quote } from "@/lib/db/quotes";
import { getDeal } from "@/lib/db/deals";
import { createNotification } from "@/lib/db/notifications";
import { roleFromLabels, canEnterCrm } from "@/lib/roles";
import { quoteExpiry, QUOTE_WARN_DAYS } from "@/lib/quote-expiry";
import { formatDayMonth } from "@/lib/dates";
import { sendPush, sendMail, esc, APP_URL, isWorkingTime } from "@/lib/leads/notify";
import { CRM_INSTANCE_NAME } from "@/lib/instance";

/** Expired quotes older than this are only shown red, no late alert (avoids a burst of old ones) */
const LATE_ALERT_MAX_DAYS = 7;

function quoteTotal(q: Quote): number {
  try {
    const items = JSON.parse(q.items) as { quantity: number; unitPrice: number; discount?: number }[];
    const sub = items.reduce((s, i) => s + Math.round(i.quantity * i.unitPrice * (1 - (i.discount ?? 0) / 100)), 0);
    return sub + Math.round((sub * (q.vatRate ?? 0)) / 100);
  } catch {
    return 0;
  }
}

const euro = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

async function crmAdmins(): Promise<{ ids: string[]; emails: string[] }> {
  const res = await users.list([Query.limit(100)]);
  const ids: string[] = [];
  const emails: string[] = [];
  for (const u of res.users) {
    if (!u.status || !canEnterCrm(u.labels) || roleFromLabels(u.labels) !== "admin") continue;
    ids.push(u.$id);
    if (u.email) emails.push(u.email);
  }
  return { ids, emails };
}

export async function runQuoteExpiryChecks(nowMs = Date.now()): Promise<{ pre: number; due: number }> {
  // Alerts only in the daytime (Rome), so nobody gets pinged at night
  if (!isWorkingTime(nowMs, "1-7 08:00-20:00")) return { pre: 0, due: 0 };

  const quotes = await listQuotes();
  const todo: { q: Quote; stage: "pre" | "due"; days: number }[] = [];
  for (const q of quotes) {
    const e = quoteExpiry(q, nowMs);
    if (e.days === null || (e.state !== "soon" && e.state !== "expired")) continue;
    const stage = e.days <= 0 ? "due" : "pre";
    if (q.expiryAlert === "due" || q.expiryAlert === stage) continue;
    if (e.days < -LATE_ALERT_MAX_DAYS) continue;
    todo.push({ q, stage, days: e.days });
  }
  if (todo.length === 0) return { pre: 0, due: 0 };

  const admins = await crmAdmins();
  const crm = CRM_INSTANCE_NAME || "CRM SarconX";
  let pre = 0;
  let due = 0;

  for (const { q, stage, days } of todo) {
    const deal = await getDeal(q.dealId).catch(() => null);
    // Deal deleted (orphan quote) or paid on the deal (Finance "pagato"): no alert, ever
    if (!deal || deal.isPaid) {
      await updateQuote(q.id, { expiryAlert: "due" });
      continue;
    }
    const who = deal?.contactName || deal?.title || q.title;
    const when = formatDayMonth(new Date(q.validUntil as string).getTime());
    const title =
      stage === "pre"
        ? `Preventivo in scadenza ${days === 1 ? "domani" : `tra ${days} giorni`} · ${who}`
        : days === 0
          ? `Preventivo scade oggi, non pagato · ${who}`
          : `Preventivo scaduto e non pagato · ${who}`;
    const body = `${q.title} · ${euro(quoteTotal(q))} · valido fino al ${when} · ${q.number}`;
    const url = `${APP_URL}/deals/${q.dealId}`;

    await Promise.allSettled([
      ...admins.ids.map((userId) =>
        createNotification({
          userId,
          type: "quote_expiring",
          title,
          body,
          relatedId: q.dealId,
          relatedType: "deal",
          fromUserName: crm,
        })
      ),
      sendPush({ title, body, url: `/deals/${q.dealId}`, tag: `quote-${q.id}-${stage}` }, admins.ids),
      sendMail(
        admins.emails,
        `${title} (${crm})`,
        `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">
          <p style="margin:0 0 8px"><strong>${esc(title)}</strong></p>
          <p style="margin:0 0 8px">${esc(body)}</p>
          <p style="margin:0 0 8px;color:#666">Se è già stato pagato, aprilo e premi «Segna come pagato»: gli avvisi si fermano.</p>
          <p style="margin:16px 0"><a href="${url}" style="background:#c2410c;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Apri la trattativa</a></p>
        </div>`,
        `${title}\n${body}\nSe è già stato pagato premi «Segna come pagato».\n${url}`
      ),
    ]);
    await updateQuote(q.id, { expiryAlert: stage });
    if (stage === "pre") pre++;
    else due++;
  }
  return { pre, due };
}

export { QUOTE_WARN_DAYS };
