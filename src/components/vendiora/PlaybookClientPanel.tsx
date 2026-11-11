"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, CircleAlert, ListTodo, Rocket, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { eur, TASK_ROLE_LABELS, type ClientOps, type Installment, type VdCall, type VdClient, type VdTask } from "@/lib/vendiora/types";
import {
  CONSULENZA_STAGES, DFY_STAGES, HEALTH_CONFIG, UPSELL_STAGES, VALUE_LADDER, CONTINUOUS_SERVICES, playbookPackage, stageLabel,
} from "@/lib/vendiora/playbook";
import { api, Field, Panel, Pill, fmtDate, inputCls, euroInput, parseEuro, toDateInputValue } from "./ui";

type Patch = (p: Record<string, unknown>, msg?: string) => Promise<void>;

/** Playbook header of the client: stage O1–O7 / D1–D8, health, activation */
export function PlaybookStrip({ c, calls, onPatch, onActivate }: { c: VdClient; calls: VdCall[]; onPatch: Patch; onActivate: () => void }) {
  const pb = playbookPackage(c.packageCode);
  if (!pb) return null;
  const stages = pb.line === "dfy" ? DFY_STAGES : CONSULENZA_STAGES;
  const cur = c.stage ?? stages[0].id;
  const idx = stages.findIndex((s) => s.id === cur);
  const h = c.health ? HEALTH_CONFIG[c.health] : null;
  const next = calls.filter((k) => k.status !== "fatta" && k.status !== "saltata").sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"))[0];
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="bg-orange-500/10 text-orange-700 ring-orange-500/25 dark:text-orange-300">{pb.code} · {pb.line === "dfy" ? "Done For You" : "Consulenza"}</Pill>
        <span className="text-sm font-semibold">{stageLabel(cur)}</span>
        {h && <Pill tone={h.tone}><span className={cn("size-1.5 rounded-full", h.dot)} />Salute {h.label}{c.healthScore != null ? ` · ${c.healthScore}/100` : ""}</Pill>}
        {next && <span className="text-[12.5px] text-muted-foreground">Prossima: <b>{next.code ?? `Call ${next.number}`}</b> {next.scheduledAt ? `il ${fmtDate(next.scheduledAt, true)}` : next.dueAt ? `entro il ${fmtDate(next.dueAt)}` : ""}</span>}
        <span className="ml-auto" />
        {!c.ops.activatedAt ? (
          <Button size="sm" onClick={onActivate} disabled={!c.isPaid} title={c.isPaid ? "" : "Registra prima il pagamento"}><Rocket /> Attiva percorso</Button>
        ) : <span className="text-[12px] text-muted-foreground">Attivato il {fmtDate(c.ops.activatedAt)}</span>}
      </div>
      <ol className="flex gap-1 overflow-x-auto pb-1">
        {stages.map((s, i) => (
          <li key={s.id} className="min-w-[96px] flex-1">
            <button type="button" title={s.exit ? `Per uscire: ${s.exit}` : ""} onClick={() => s.id !== cur && confirm(`Spostare ${c.name} in «${s.id} · ${s.label}»? Di solito la fase avanza da sola.`) && onPatch({ stage: s.id }, `Fase: ${s.label}`)}
              className={cn("w-full rounded-lg border px-2 py-1.5 text-left text-[11.5px] leading-tight", i < idx && "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-800 dark:text-emerald-300", i === idx && "border-orange-500 bg-orange-500/[0.08] font-semibold", i > idx && "text-muted-foreground hover:bg-accent")}>
              <span className="block font-bold">{s.id}</span>{s.label}
            </button>
          </li>
        ))}
      </ol>
      {c.ops.healthSignals?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {c.ops.healthSignals.map((sg) => {
            const t = HEALTH_CONFIG[sg.value as keyof typeof HEALTH_CONFIG];
            return <span key={sg.key} title={sg.detail} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", t?.tone)}>{sg.label}: {sg.detail}</span>;
          })}
        </div>
      ) : null}
    </section>
  );
}

/** Milestones of the package (onboarding, accesses DFY, store, ads, testimonial) */
export function PlaybookMilestones({ c, onPatch }: { c: VdClient; onPatch: Patch }) {
  const pb = playbookPackage(c.packageCode);
  if (!pb) return null;
  const o = c.ops;
  const ms: { k: keyof ClientOps; label: string }[] = pb.line === "dfy"
    ? [{ k: "briefAt", label: "Brief compilato" }, { k: "accessesAt", label: "Accessi ricevuti" }, { k: "storeReadyAt", label: "Store consegnato" },
      ...(pb.code !== "DFY-S" ? [{ k: "adsLaunchedAt" as const, label: "Ads lanciate" }] : []), { k: "testimonialAt", label: "Testimonianza" }]
    : [{ k: "intakeAt", label: "Intake form" }, { k: "groupAt", label: "Gruppo WhatsApp" }, { k: "quickWinAt", label: "Quick win consegnata" },
      { k: "planAt", label: "Piano personalizzato" }, { k: "testimonialAt", label: "Testimonianza" }];
  return (
    <Panel title="Tappe del pacchetto">
      <div className="grid gap-2 sm:grid-cols-2">
        {ms.map((m) => {
          const at = o[m.k] as string | null | undefined;
          return (
            <button key={m.k} type="button" onClick={() => onPatch({ ops: { [m.k]: at ? null : true } }, at ? "Tolto" : `${m.label}: fatto`)}
              className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px]", at ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "hover:bg-accent")}>
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", at ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30")}>{at && <Check className="size-3" />}</span>
              <span><span className="block font-medium">{m.label}</span><span className="text-[11.5px] text-muted-foreground">{at ? fmtDate(at) : "da fare"}</span></span>
            </button>
          );
        })}
      </div>
      {pb.line === "dfy" && pb.access.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12.5px] font-semibold">Accessi da ricevere {o.accessesRequestedAt ? <span className="font-normal text-muted-foreground">· richiesti il {fmtDate(o.accessesRequestedAt)}</span> : null}</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {pb.access.map((a) => (
              <label key={a} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="size-4 accent-orange-500" checked={!!o.access?.[a]} onChange={(e) => onPatch({ ops: { access: { ...(o.access ?? {}), [a]: e.target.checked } } })} /> {a}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">Ogni giorno di ritardo negli accessi sposta la consegna (art. 3 del contratto): i solleciti partono da soli a 48 h, 72 h e 5 giorni.</p>
        </div>
      )}
    </Panel>
  );
}

export function PlaybookGoal({ c, onPatch }: { c: VdClient; onPatch: Patch }) {
  const o = c.ops;
  const [f, setF] = useState({ objective: o.objective ?? "", kpiName: o.kpiName ?? "", kpiStart: o.kpiStart?.toString() ?? "", kpiTarget: o.kpiTarget?.toString() ?? "", val: "" });
  const last = o.kpi?.[o.kpi.length - 1];
  const h = o.handover;
  return (
    <Panel title="Obiettivo e KPI">
      <div className="space-y-3">
        {h && (h.goal || h.motivation || h.fears || h.promises) && (
          <div className="rounded-lg bg-muted/50 p-3 text-[12.5px]">
            <p className="mb-1 font-semibold">Scheda di passaggio dal commerciale</p>
            {h.goal && <p><b>Obiettivo:</b> {h.goal}</p>}{h.motivation && <p><b>Perché:</b> {h.motivation}</p>}
            {h.fears && <p><b>Paure:</b> {h.fears}</p>}{h.promises && <p><b>Promesso in call:</b> {h.promises}</p>}
          </div>
        )}
        <Field label="Obiettivo del percorso"><input className={inputCls} value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} placeholder="Es. primo store online e 10 vendite" /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="KPI"><input className={inputCls} value={f.kpiName} onChange={(e) => setF({ ...f, kpiName: e.target.value })} placeholder="Vendite/mese" /></Field>
          <Field label="Partenza"><input className={inputCls} inputMode="decimal" value={f.kpiStart} onChange={(e) => setF({ ...f, kpiStart: e.target.value })} /></Field>
          <Field label="Target"><input className={inputCls} inputMode="decimal" value={f.kpiTarget} onChange={(e) => setF({ ...f, kpiTarget: e.target.value })} /></Field>
        </div>
        <div className="flex items-end gap-2">
          <Field label={`Valore attuale${last ? ` (ultimo: ${last.value} il ${fmtDate(last.at)})` : ""}`} className="flex-1"><input className={inputCls} inputMode="decimal" value={f.val} onChange={(e) => setF({ ...f, val: e.target.value })} /></Field>
          <Button size="sm" onClick={async () => { await onPatch({ ops: { objective: f.objective, kpiName: f.kpiName, kpiStart: f.kpiStart, kpiTarget: f.kpiTarget, ...(f.val ? { kpiValue: f.val } : {}) } }); setF({ ...f, val: "" }); }}>Salva</Button>
        </div>
        <div className="flex flex-wrap gap-3 border-t pt-3 text-[12.5px] text-muted-foreground">
          <span>Voto al coach: <b className="text-foreground">{o.coachVote ?? o.g7Vote ?? "—"}</b>/5</span>
          <span>NPS: <b className="text-foreground">{o.nps ?? "—"}</b>/10</span>
          <span>Check-in: <b className="text-foreground">{o.checkins?.length ?? 0}</b></span>
          {o.referralCode && <span>Referral <b className="text-foreground">{o.referralCode}</b> · {o.referrals?.length ?? 0} lead</span>}
        </div>
      </div>
    </Panel>
  );
}

/** Installments (M9): due dates, paid / failed */
export function PlaybookInstallments({ c, onPatch }: { c: VdClient; onPatch: Patch }) {
  const rows = c.ops.installments ?? [];
  const [n, setN] = useState(2);
  const save = (next: Installment[]) => onPatch({ ops: { installments: next } }, "Rate aggiornate");
  if (!rows.length) {
    return (
      <Panel title="Pagamento">
        <p className="text-[13px] text-muted-foreground">{c.isPaid ? `Saldato${c.paidAt ? ` il ${fmtDate(c.paidAt)}` : ""}.` : "Pagamento unico non ancora registrato."}</p>
        <div className="mt-3 flex items-end gap-2">
          <Field label="Dividi in rate" className="w-28"><select className={inputCls} value={n} onChange={(e) => setN(Number(e.target.value))}>{[2, 3, 4, 6].map((x) => <option key={x} value={x}>{x} rate</option>)}</select></Field>
          <Button size="sm" variant="outline" onClick={() => {
            const base = Math.floor(c.price / n);
            const start = Date.parse(c.paidAt ?? c.contractDate);
            save(Array.from({ length: n }, (_, i) => ({ n: i + 1, amount: i === n - 1 ? c.price - base * (n - 1) : base, dueAt: new Date(start + i * 30 * 86_400_000).toISOString(), status: i === 0 && c.isPaid ? "pagata" : "da_pagare", paidAt: i === 0 && c.isPaid ? c.paidAt : null })));
          }}>Crea piano rate</Button>
        </div>
      </Panel>
    );
  }
  return (
    <Panel title={`Rate · ${c.ops.paymentStatus === "a_rischio" ? "a rischio" : c.ops.paymentStatus === "saldato" ? "saldato" : "in corso"}`}>
      <ul className="divide-y">
        {rows.map((r, i) => (
          <li key={r.n} className="flex flex-wrap items-center gap-2 py-2 text-[13px]">
            <span className="w-14 font-semibold">Rata {r.n}</span>
            <input className={inputCls + " h-8 w-24"} defaultValue={euroInput(r.amount)} onBlur={(e) => { const v = parseEuro(e.target.value); if (v != null && v !== r.amount) save(rows.map((x, j) => (j === i ? { ...x, amount: v } : x))); }} />
            <input type="date" className={inputCls + " h-8 w-36"} defaultValue={toDateInputValue(r.dueAt)} onBlur={(e) => e.target.value && save(rows.map((x, j) => (j === i ? { ...x, dueAt: new Date(e.target.value + "T09:00").toISOString() } : x)))} />
            <select className={cn(inputCls, "h-8 w-32", r.status === "pagata" && "text-emerald-700", r.status === "fallita" && "text-rose-600")} value={r.status} onChange={(e) => save(rows.map((x, j) => (j === i ? { ...x, status: e.target.value as Installment["status"] } : x)))}>
              <option value="da_pagare">Da pagare</option><option value="pagata">Pagata</option><option value="fallita">Non riuscita</option>
            </select>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11.5px] text-muted-foreground">Promemoria 3 giorni prima e il giorno della scadenza; se una rata non va a buon fine partono i solleciti (M9) e un task all&apos;admin.</p>
    </Panel>
  );
}

export function PlaybookUpsell({ c, onPatch }: { c: VdClient; onPatch: Patch }) {
  const u = c.ops.upsell;
  const options = VALUE_LADDER.filter((v) => c.packageCode && v.from.includes(c.packageCode as never));
  return (
    <Panel title={<span className="flex items-center gap-2"><TrendingUp className="size-4 text-orange-500" /> Upsell</span>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {UPSELL_STAGES.map((s) => (
            <button key={s.id} type="button" title={s.hint} onClick={() => onPatch({ ops: { upsell: { stage: s.id } } }, `Upsell: ${s.label}`)}
              className={cn("rounded-md border px-2 py-1 text-[11.5px]", u?.stage === s.id ? "border-orange-500 bg-orange-500/[0.08] font-semibold" : "hover:bg-accent")}>{s.id} {s.label}</button>
          ))}
        </div>
        <Field label="Pronto per il livello successivo?">
          <select className={inputCls} value={u?.readiness ?? ""} onChange={(e) => onPatch({ ops: { upsell: { stage: u?.stage ?? "U1", readiness: e.target.value || null } } })}>
            <option value="">—</option><option value="si">Sì</option><option value="forse">Forse</option><option value="no">No</option>
          </select>
        </Field>
        <Field label="Proposta">
          <select className={inputCls} value={u?.suggested ?? ""} onChange={(e) => onPatch({ ops: { upsell: { stage: u?.stage ?? "U1", suggested: e.target.value || null } } })}>
            <option value="">—</option>
            {options.map((v) => <option key={v.to} value={v.to}>{v.to}</option>)}
            {CONTINUOUS_SERVICES.map((s) => <option key={s.id} value={s.label}>Servizio: {s.label}</option>)}
          </select>
        </Field>
        {options.length > 0 && <ul className="space-y-1 text-[11.5px] text-muted-foreground">{options.map((v) => <li key={v.to}><b className="text-foreground">{v.to}</b> – {v.who} ({v.when})</li>)}</ul>}
      </div>
    </Panel>
  );
}

/** Open team tasks (playbook) for a client or lead */
export function TasksPanel({ clientId, leadId, refreshKey }: { clientId?: string; leadId?: string; refreshKey?: number }) {
  const [tasks, setTasks] = useState<VdTask[] | null>(null);
  const q = clientId ? `clientId=${clientId}` : `leadId=${leadId}`;
  const load = useCallback(() => api<{ tasks: VdTask[] }>(`/api/vendiora/tasks?${q}`).then((r) => setTasks(r.tasks)).catch(() => setTasks([])), [q]);
  useEffect(() => { load(); }, [load, refreshKey]);
  async function done(t: VdTask) {
    try { await api(`/api/vendiora/tasks/${t.id}`, { method: "PUT", json: { status: "fatto" } }); setTasks((x) => x?.filter((y) => y.id !== t.id) ?? null); toast.success("Fatto"); } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <Panel title={<span className="flex items-center gap-2"><ListTodo className="size-4 text-orange-500" /> Da fare per il team</span>} action={<Link href="/vendiora/task" className="text-[12px] text-muted-foreground underline">Tutti</Link>}>
      {!tasks ? <p className="text-sm text-muted-foreground">…</p> : tasks.length === 0 ? <p className="text-sm text-muted-foreground">Niente in sospeso.</p> : (
        <ul className="space-y-2">
          {tasks.map((t) => <TaskItem key={t.id} t={t} onDone={() => done(t)} />)}
        </ul>
      )}
    </Panel>
  );
}

export function TaskItem({ t, onDone, showWho }: { t: VdTask; onDone: () => void; showWho?: boolean }) {
  const [open, setOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const late = t.dueAt && Date.parse(t.dueAt) < now;
  return (
    <li className={cn("rounded-lg border p-2.5", t.urgent && "border-rose-500/40 bg-rose-500/[0.04]")}>
      <div className="flex items-start gap-2">
        <button type="button" aria-label="Segna fatto" onClick={onDone} className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-500/10"><Check className="size-3 opacity-0 hover:opacity-100" /></button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)}>
          <span className="block text-[13px] font-semibold">{t.urgent && <CircleAlert className="mr-1 inline size-3.5 text-rose-500" />}{t.title}</span>
          <span className={cn("text-[11.5px] text-muted-foreground", late && "text-rose-600")}>{TASK_ROLE_LABELS[t.role]}{t.dueAt ? ` · ${late ? "scaduto " : "entro "}${fmtDate(t.dueAt, true)}` : ""}{showWho && (t.clientId || t.leadId) ? " · " : ""}
            {showWho && t.clientId && <Link className="underline" href={`/vendiora/clienti/${t.clientId}`} onClick={(e) => e.stopPropagation()}>scheda cliente</Link>}
            {showWho && !t.clientId && t.leadId && <Link className="underline" href={`/leads/${t.leadId}`} onClick={(e) => e.stopPropagation()}>scheda lead</Link>}
          </span>
        </button>
      </div>
      {open && t.detail && <p className="mt-2 whitespace-pre-wrap pl-7 text-[12.5px] text-muted-foreground">{t.detail}</p>}
    </li>
  );
}

export const callCodeLabel = (k: VdCall) => (k.code ? `${k.code}` : `${k.number}`);
export { eur };
