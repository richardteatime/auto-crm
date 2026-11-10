"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Bot, CalendarClock, CheckCircle2, Circle, Info, MessageCircle, Package, PhoneCall, UserRoundCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { eur } from "@/lib/vendiora/types";
import { api, Panel, Stat, fmtDate } from "./ui";

interface Dash {
  admin: boolean;
  funnel: { leadToday: number; leadWeek: number; contacted: number; qualified: number; inBot: number; waiting: number; won: number; total: number };
  sales: null | { clientsActive: number; building: number; coaching: number; soldMonthCount: number; soldMonthValue: number; cashed: number; toCash: number; packages: number; packagesNoPrice: number; callsDoneWeek: number };
  alerts: Array<{ kind: string; text: string; href: string }>;
  upcoming: Array<{ id: string; clientId: string; clientName: string; title: string; at: string }>;
  setup: { wa: string; waPhone: string | null; botEnabled: boolean; calendly: boolean; handoff: boolean };
}

const WA_LABEL: Record<string, string> = {
  connected: "WhatsApp collegato", qr: "In attesa della scansione del QR", connecting: "WhatsApp si sta collegando", reconnecting: "WhatsApp si sta ricollegando",
  disconnected: "WhatsApp non collegato", logged_out: "WhatsApp scollegato dal telefono", not_configured: "Servizio WhatsApp non ancora attivo", unreachable: "Servizio WhatsApp non raggiungibile",
};

export function VendioraHome() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<Dash>("/api/vendiora/dashboard").then(setD).catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span>Vendi<span className="text-orange-500">Ora</span></span>}
        description="Lead dalle campagne, bot WhatsApp, pacchetti venduti, contratti e call di affiancamento."
        actions={
          <>
            <Link href="/leads" className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium shadow-card hover:bg-accent"><PhoneCall className="size-4" /> Lead</Link>
            <Link href="/vendiora/whatsapp" className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-500 px-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"><MessageCircle className="size-4" /> WhatsApp</Link>
          </>
        }
      />
      {err && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{err}</p>}
      {!d && !err && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}</div>}
      {d && (
        <>
          <Setup d={d} />
          <div>
            <h2 className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Acquisizione</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Lead oggi" value={d.funnel.leadToday} hint={`${d.funnel.leadWeek} negli ultimi 7 giorni`} />
              <Stat label="Contattati dal bot" value={d.funnel.contacted} hint={`${d.funnel.inBot} stanno rispondendo ora`} />
              <Stat label="Qualificati" value={d.funnel.qualified} hint="hanno risposto a tutte le domande" />
              <Stat label="Aspettano una risposta" value={d.funnel.waiting} hint="ultimo messaggio è del lead" accent={d.funnel.waiting > 0} />
            </div>
          </div>
          {d.sales && (
            <div>
              <h2 className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Vendite e clienti</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Venduto questo mese" value={eur(d.sales.soldMonthValue)} hint={`${d.sales.soldMonthCount} pacchetti · IVA esclusa`} accent />
                <Stat label="Incassato" value={eur(d.sales.cashed)} hint={`da incassare ${eur(d.sales.toCash)}`} />
                <Stat label="Clienti attivi" value={d.sales.clientsActive} hint={`${d.sales.building} store in costruzione · ${d.sales.coaching} in affiancamento`} />
                <Stat label="Call fatte (7 giorni)" value={d.sales.callsDoneWeek} hint={`${d.upcoming.length} prossime in calendario`} />
              </div>
            </div>
          )}
          {d.admin && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Da sistemare" action={<span className="text-xs text-muted-foreground">{d.alerts.length}</span>}>
                {d.alerts.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-500" /> Tutto in ordine.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {d.alerts.map((a, i) => (
                      <li key={i}>
                        <Link href={a.href} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-accent">
                          {a.kind === "danger" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" /> : a.kind === "warn" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" /> : <Info className="mt-0.5 size-4 shrink-0 text-sky-500" />}
                          <span className="flex-1">{a.text}</span>
                          <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Prossime call" action={<Link href="/vendiora/call" className="text-xs font-semibold text-orange-600 hover:underline">Tutte</Link>}>
                {d.upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessuna call in calendario.</p>
                ) : (
                  <ul className="divide-y">
                    {d.upcoming.map((c) => (
                      <li key={c.id}>
                        <Link href={`/vendiora/clienti/${c.clientId}`} className="flex items-center gap-3 py-2 text-sm hover:text-orange-600">
                          <CalendarClock className="size-4 text-muted-foreground" />
                          <span className="w-32 shrink-0 tabular-nums text-muted-foreground">{fmtDate(c.at, true)}</span>
                          <span className="flex-1 truncate font-medium">{c.clientName}</span>
                          <span className="truncate text-xs text-muted-foreground">{c.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}
          {d.admin && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Shortcut href="/vendiora/clienti" icon={UserRoundCheck} title="Clienti" text="Pacchetti venduti, contratti, avanzamento dello store" />
              <Shortcut href="/vendiora/pacchetti" icon={Package} title="Pacchetti" text={d.sales ? `${d.sales.packages} attivi${d.sales.packagesNoPrice ? ` · ${d.sales.packagesNoPrice} senza prezzo` : ""}` : ""} />
              <Shortcut href="/vendiora/impostazioni" icon={Bot} title="Bot e azienda" text="Messaggi del bot, domande, link calendario, dati per i contratti" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Shortcut({ href, icon: Icon, title, text }: { href: string; icon: typeof Bot; title: string; text: string }) {
  return (
    <Link href={href} className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-orange-500/40">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600"><Icon className="size-[18px]" /></span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-bold">{title}<ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" /></span>
        <span className="block text-[12.5px] text-muted-foreground">{text}</span>
      </span>
    </Link>
  );
}

function Setup({ d }: { d: Dash }) {
  const steps = [
    { ok: d.setup.wa === "connected", label: d.setup.wa === "connected" ? `WhatsApp collegato${d.setup.waPhone ? ` (+${d.setup.waPhone})` : ""}` : WA_LABEL[d.setup.wa] ?? d.setup.wa },
    { ok: d.setup.botEnabled, label: d.setup.botEnabled ? "Bot acceso: scrive a ogni nuovo lead" : "Bot spento" },
    { ok: d.setup.calendly, label: d.setup.calendly ? "Link per prenotare la call impostato" : "Manca il link per prenotare la call" },
    { ok: d.setup.handoff, label: d.setup.handoff ? "Chi riceve i lead qualificati: impostato" : "Scegli chi riceve gli avvisi dei lead qualificati" },
  ];
  if (steps.every((s) => s.ok)) return null;
  return (
    <div className="rounded-xl border border-orange-500/30 bg-orange-500/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">Per far partire il bot</p>
        {d.admin && <Link href="/vendiora/impostazioni" className="text-sm font-semibold text-orange-600 hover:underline">Configura →</Link>}
      </div>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.label} className={cn("flex items-center gap-2 text-[13px]", s.ok ? "text-muted-foreground" : "font-medium")}>
            {s.ok ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-orange-500" />}
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
