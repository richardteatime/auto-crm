import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listLeads, leadInScope } from "@/lib/db/leads";
import { listClients, listCalls, listConversations, latestMessages, listPackages } from "@/lib/vendiora/db";
import { guaranteeDeadline } from "@/lib/vendiora/types";
import { waStatus } from "@/lib/vendiora/wa";
import { getSettings } from "@/lib/vendiora/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const admin = auth.user.role === "admin";
  const now = Date.now();
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const week0 = now - 7 * 86_400_000;
  const month0 = new Date(); month0.setDate(1); month0.setHours(0, 0, 0, 0);

  const [leads, convs, msgs, wa, settings] = await Promise.all([
    listLeads({ max: 3000 }), listConversations(), latestMessages(100), waStatus(), getSettings(),
  ]);
  const mine = leads.filter(leadInScope);
  const ids = new Set(mine.map((l) => l.id));
  const myConvs = convs.filter((c) => ids.has(c.leadId));

  const lastByLead = new Map<string, string>();
  for (const m of msgs) if (m.leadId && !lastByLead.has(m.leadId)) lastByLead.set(m.leadId, m.direction);

  const funnel = {
    leadToday: mine.filter((l) => Date.parse(l.createdAt) >= day0.getTime()).length,
    leadWeek: mine.filter((l) => Date.parse(l.createdAt) >= week0).length,
    contacted: myConvs.length,
    qualified: myConvs.filter((c) => c.state === "passato" && c.answers.length > 0).length,
    inBot: myConvs.filter((c) => c.state === "attivo" || c.state === "in_attesa").length,
    waiting: [...lastByLead.entries()].filter(([id, d]) => d === "in" && ids.has(id)).length,
    won: mine.filter((l) => l.status === "vinto").length,
    total: mine.length,
  };

  let sales = null;
  let alerts: Array<{ kind: string; text: string; href: string }> = [];
  let upcoming: Array<{ id: string; clientId: string; clientName: string; title: string; at: string }> = [];
  if (admin) {
    const [clients, calls, packages] = await Promise.all([listClients(), listCalls(), listPackages()]);
    const live = clients.filter((c) => c.status !== "sospeso");
    const soldMonth = live.filter((c) => Date.parse(c.contractDate) >= month0.getTime());
    sales = {
      clientsActive: clients.filter((c) => ["onboarding", "costruzione", "affiancamento"].includes(c.status)).length,
      building: clients.filter((c) => c.status === "costruzione").length,
      coaching: clients.filter((c) => c.status === "affiancamento").length,
      soldMonthCount: soldMonth.length,
      soldMonthValue: soldMonth.reduce((s, c) => s + c.price, 0),
      cashed: live.filter((c) => c.isPaid).reduce((s, c) => s + c.price, 0),
      toCash: live.filter((c) => !c.isPaid).reduce((s, c) => s + c.price, 0),
      packages: packages.filter((p) => p.active).length,
      packagesNoPrice: packages.filter((p) => p.active && p.price == null).length,
      callsDoneWeek: calls.filter((c) => c.status === "fatta" && c.doneAt && Date.parse(c.doneAt) >= week0).length,
    };
    const byClient = new Map(clients.map((c) => [c.id, c]));
    upcoming = calls
      .filter((c) => c.status === "prenotata" && c.scheduledAt && Date.parse(c.scheduledAt) >= now - 3600_000 && byClient.has(c.clientId))
      .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))
      .slice(0, 8)
      .map((c) => ({ id: c.id, clientId: c.clientId, clientName: c.clientName, title: c.title, at: c.scheduledAt! }));
    for (const c of clients) {
      if (c.status === "costruzione" && !c.storeLiveAt) {
        const dl = guaranteeDeadline(c);
        if (dl) {
          const left = Math.ceil((dl.getTime() - now) / 86_400_000);
          if (left <= 2) alerts.push({ kind: left < 0 ? "danger" : "warn", text: left < 0 ? `${c.name}: garanzia scaduta da ${-left} g e store non online` : `${c.name}: lo store va messo online entro ${left} g (garanzia)`, href: `/vendiora/clienti/${c.id}` });
        }
      }
      if (c.status === "onboarding" && !c.contractSignedAt && now - Date.parse(c.contractDate) > 3 * 86_400_000) alerts.push({ kind: "warn", text: `${c.name}: contratto ${c.contractNumber} non ancora firmato`, href: `/vendiora/clienti/${c.id}` });
      if (!c.isPaid && c.status !== "sospeso" && now - Date.parse(c.contractDate) > 7 * 86_400_000) alerts.push({ kind: "warn", text: `${c.name}: pagamento non registrato`, href: `/vendiora/clienti/${c.id}` });
      if (c.status === "affiancamento" && !calls.some((k) => k.clientId === c.id && k.status === "prenotata")) {
        const left = calls.filter((k) => k.clientId === c.id && k.status === "da_prenotare").length;
        if (left) alerts.push({ kind: "info", text: `${c.name}: nessuna call prenotata (${left} da fare)`, href: `/vendiora/clienti/${c.id}` });
      }
    }
    if (sales.packagesNoPrice) alerts.unshift({ kind: "info", text: `${sales.packagesNoPrice} pacchetto/i senza prezzo`, href: "/vendiora/pacchetti" });
    alerts = alerts.slice(0, 12);
  }

  const setup = {
    wa: wa.status,
    waPhone: wa.phone,
    botEnabled: settings.bot.enabled,
    calendly: !!settings.bot.calendlyUrl,
    handoff: settings.bot.handoffUserIds.length > 0,
  };

  return NextResponse.json({ funnel, sales, alerts, upcoming, setup, admin });
}
