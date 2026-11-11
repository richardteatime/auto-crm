"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, ExternalLink, FileSignature, Phone, Rocket, Trash2, Video, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CALL_STATUS_CONFIG, CLIENT_STATUSES, CLIENT_STATUS_CONFIG, eur, guaranteeDeadline,
  AUTO_INFO, type CallStatus, type VdCall, type VdClient, type VdPackage,
} from "@/lib/vendiora/types";
import { api, Field, Panel, Pill, fmtDate, inputCls, textareaCls, toDateInputValue, toLocalInputValue } from "./ui";
import { WaChat } from "./WaChat";
import { JourneyTimeline } from "./JourneyTimeline";

export function ClientDetail({ id }: { id: string }) {
  const router = useRouter();
  const [c, setC] = useState<VdClient | null>(null);
  const [calls, setCalls] = useState<VdCall[]>([]);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const load = useCallback(() => api<{ client: VdClient; calls: VdCall[] }>(`/api/vendiora/clients/${id}`).then((r) => { setC(r.client); setCalls(r.calls); setNotes(r.client.notes ?? ""); }).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  async function patch(p: Record<string, unknown>, msg = "Salvato") {
    try {
      const r = await api<{ client: VdClient; auto?: { sent: boolean; reason?: string } }>(`/api/vendiora/clients/${id}`, { method: "PUT", json: p });
      setC(r.client);
      toast.success(msg, { description: r.auto ? (r.auto.sent ? "Messaggio «store online» inviato su WhatsApp" : `Messaggio «store online» non inviato: ${r.auto.reason}`) : undefined });
      setTick((t) => t + 1);
    } catch (e) { toast.error((e as Error).message); }
  }
  async function sendAuto(key: "welcome" | "storeLive" | "coachingEnd") {
    const already = c?.autoLog[key];
    if (already && !confirm(`«${AUTO_INFO[key].label}» è già stato inviato il ${fmtDate(already, true)}. Lo rimando?`)) return;
    try { const r = await api<{ client: VdClient }>(`/api/vendiora/clients/${id}`, { json: { send: key, force: !!already } }); setC(r.client); setTick((t) => t + 1); toast.success("Inviato su WhatsApp"); } catch (e) { toast.error((e as Error).message); }
  }
  async function patchCall(callId: string, p: Record<string, unknown>) {
    try { const r = await api<{ call: VdCall }>(`/api/vendiora/calls/${callId}`, { method: "PUT", json: p }); setCalls((cs) => cs.map((x) => (x.id === callId ? r.call : x))); } catch (e) { toast.error((e as Error).message); }
  }
  async function planWeekly() {
    try { const r = await api<{ planned: number }>("/api/vendiora/calls", { json: { clientId: id } }); toast.success(`${r.planned} call messe in calendario, una a settimana`); load(); } catch (e) { toast.error((e as Error).message); }
  }
  async function remove() {
    if (!c || !confirm(`Eliminare ${c.name} e le sue call? Il contratto non sarà più apribile.`)) return;
    try { await api(`/api/vendiora/clients/${id}`, { method: "DELETE" }); router.push("/vendiora/clienti"); } catch (e) { toast.error((e as Error).message); }
  }

  if (err) return <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{err}</p>;
  if (!c) return <div className="space-y-4"><Skeleton className="h-12 w-80" /><Skeleton className="h-72 rounded-xl" /></div>;

  let pkg: Partial<VdPackage> = {};
  try { pkg = c.packageSnapshot ? JSON.parse(c.packageSnapshot) : {}; } catch { /* */ }
  const dl = guaranteeDeadline(c);
  const left = dl && !c.storeLiveAt ? Math.ceil((dl.getTime() - now) / 86_400_000) : null;
  const done = calls.filter((k) => k.status === "fatta").length;

  const steps = [
    { label: "Contratto firmato", done: !!c.contractSignedAt, at: c.contractSignedAt, action: () => patch({ contractSignedAt: c.contractSignedAt ? null : new Date().toISOString() }) },
    { label: "Pagamento ricevuto", done: c.isPaid, at: c.paidAt, action: () => patch({ isPaid: !c.isPaid }) },
    { label: "Call di avvio (kick-off)", done: !!c.kickoffAt, at: c.kickoffAt, action: () => patch({ kickoffAt: c.kickoffAt ? null : new Date().toISOString() }, "Kick-off segnato: partono i giorni della garanzia") },
    { label: "Store online", done: !!c.storeLiveAt, at: c.storeLiveAt, action: () => patch({ storeLiveAt: c.storeLiveAt ? null : new Date().toISOString() }, "Store online: inizia l'affiancamento") },
  ];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={c.name}
        description={<span className="flex flex-wrap items-center gap-2"><Pill tone={CLIENT_STATUS_CONFIG[c.status].tone}>{CLIENT_STATUS_CONFIG[c.status].label}</Pill> {c.packageName} · {eur(c.price)} + IVA · contratto {c.contractNumber}</span>}
        actions={
          <>
            {c.leadId && <Link href={`/leads/${c.leadId}`} className="inline-flex h-9 items-center rounded-lg border bg-card px-3 text-sm font-medium shadow-card hover:bg-accent">Scheda lead</Link>}
            <a href={`/api/vendiora/clients/${c.id}/contract`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-500 px-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"><FileSignature className="size-4" /> Contratto</a>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <button key={s.label} type="button" onClick={s.action} className={cn("flex items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-card transition-colors hover:border-orange-500/40", s.done && "border-emerald-500/30 bg-emerald-500/[0.04]")}>
            <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2", s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30")}>{s.done && <Check className="size-3.5" />}</span>
            <span><span className="block text-sm font-semibold">{s.label}</span><span className="text-xs text-muted-foreground">{s.done ? fmtDate(s.at) : "Clicca quando è fatto"}</span></span>
          </button>
        ))}
      </div>

      {left != null && c.kickoffAt && (
        <div className={cn("flex items-center gap-3 rounded-xl border p-4 text-sm", left < 0 ? "border-rose-500/40 bg-rose-500/5" : left <= 2 ? "border-amber-500/40 bg-amber-500/5" : "bg-card")}>
          <Rocket className={cn("size-5", left < 0 ? "text-rose-500" : "text-orange-500")} />
          <span><b>{left < 0 ? `Garanzia scaduta da ${-left} giorni` : `${left} giorni`}</b> {left < 0 ? "e lo store non risulta online." : `per mettere online lo store (entro il ${fmtDate(dl!.toISOString())}, ${pkg.buildDays ?? 7} giorni dal kick-off).`}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel
            title={`Call · ${done}/${calls.length} fatte`}
            action={calls.some((k) => !k.scheduledAt && k.status !== "fatta") ? <Button size="sm" variant="outline" onClick={planWeekly}><CalendarPlus /> Una a settimana</Button> : undefined}
          >
            {calls.length === 0 ? <p className="text-sm text-muted-foreground">Questo pacchetto non include call.</p> : (
              <ul className="divide-y">
                {calls.map((k) => <CallRow key={`${k.id}-${k.scheduledAt}-${k.status}-${k.notes?.length ?? 0}`} call={k} onPatch={(p) => patchCall(k.id, p)} />)}
              </ul>
            )}
          </Panel>
          <Panel title="Note sul cliente">
            <textarea className={textareaCls + " min-h-[140px]"} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nicchia, prodotto scelto, fornitori, accessi consegnati, cosa fare alla prossima call…" />
            <div className="mt-2 flex justify-end"><Button size="sm" disabled={notes === (c.notes ?? "")} onClick={() => patch({ notes })}>Salva note</Button></div>
          </Panel>
          {c.leadId && <Panel title="WhatsApp"><WaChat leadId={c.leadId} /></Panel>}
          <Panel title="Percorso del cliente"><JourneyTimeline clientId={c.id} refreshKey={tick} /></Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Stato">
            <div className="grid gap-1.5">
              {CLIENT_STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => s !== c.status && patch({ status: s })} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm", s === c.status ? "border-orange-500 bg-orange-500/[0.06] font-semibold" : "hover:bg-accent")}>
                  <span>{CLIENT_STATUS_CONFIG[s].label}<span className="block text-[11.5px] font-normal text-muted-foreground">{CLIENT_STATUS_CONFIG[s].hint}</span></span>
                  {s === c.status && <Check className="size-4 text-orange-500" />}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Messaggi automatici">
            <div className="space-y-2">
              {(["welcome", "storeLive", "coachingEnd"] as const).map((k) => (
                <div key={k} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="font-medium">{AUTO_INFO[k].label}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{c.autoLog[k] ? `Inviato ${fmtDate(c.autoLog[k], true)}` : "Non ancora inviato"}</span>
                  </span>
                  <Button size="sm" variant="outline" className="h-7 shrink-0 text-[12px]" onClick={() => sendAuto(k)}>{c.autoLog[k] ? "Rimanda" : "Invia ora"}</Button>
                </div>
              ))}
              <p className="pt-1 text-[11.5px] text-muted-foreground">I promemoria delle call partono da soli il giorno prima. Testi in <Link className="underline" href="/vendiora/impostazioni">Impostazioni</Link>.</p>
            </div>
          </Panel>
          <ClientDataPanel key={[c.name, c.email, c.phone, c.taxId, c.address, c.storeUrl, c.coach].join("|")} c={c} onSave={(p) => patch(p)} />
          <Panel title="Pacchetto venduto">
            <p className="text-sm font-semibold">{c.packageName}</p>
            <p className="text-[13px] text-muted-foreground">{eur(c.price)} + IVA {c.vatRate}% · {pkg.includedCalls ?? 0} call · store in {pkg.buildDays ?? 7} g{pkg.coachingDays ? ` · coach ${pkg.coachingDays} g` : ""}</p>
            {c.paymentTerms && <p className="mt-2 whitespace-pre-wrap text-[13px]"><b>Pagamento:</b> {c.paymentTerms}</p>}
            <p className="mt-3 text-[11.5px] text-muted-foreground">Il contratto usa il pacchetto com&apos;era al momento della vendita: modifiche successive al listino non lo cambiano.</p>
          </Panel>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={remove}><Trash2 /> Elimina cliente</Button>
        </div>
      </div>
    </div>
  );
}

function CallRow({ call, onPatch }: { call: VdCall; onPatch: (p: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(toLocalInputValue(call.scheduledAt));
  const [notes, setNotes] = useState(call.notes ?? "");
  const cfg = CALL_STATUS_CONFIG[call.status];
  const setStatus = (status: CallStatus) => onPatch({ status });
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", call.status === "fatta" ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground")}>{call.number}</span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)}>
          <span className="block truncate text-sm font-semibold">{call.title}</span>
          <span className="text-xs text-muted-foreground">{call.status === "fatta" ? `Fatta il ${fmtDate(call.doneAt)}` : call.scheduledAt ? fmtDate(call.scheduledAt, true) : "Data da fissare"}{call.notes ? " · con note" : ""}</span>
        </button>
        <Pill tone={cfg.tone}>{cfg.label}</Pill>
        {call.status !== "fatta" ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setStatus("fatta")}><Video /> Fatta</Button>
            {call.status === "prenotata" && <Button size="icon-sm" variant="ghost" aria-label="Saltata" title="Saltata" onClick={() => setStatus("saltata")}><X /></Button>}
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setStatus(call.scheduledAt ? "prenotata" : "da_prenotare")}>Annulla</Button>
        )}
      </div>
      {open && (
        <div className="mt-3 grid gap-3 pl-11 sm:grid-cols-[220px_1fr]">
          <Field label="Data e ora"><input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} onBlur={() => when !== toLocalInputValue(call.scheduledAt) && onPatch({ scheduledAt: when ? new Date(when).toISOString() : null })} /></Field>
          <Field label="Note della call"><textarea className={textareaCls + " min-h-[60px]"} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (call.notes ?? "") && onPatch({ notes })} placeholder="Cosa si è fatto, compiti per la prossima" /></Field>
        </div>
      )}
    </li>
  );
}

function ClientDataPanel({ c, onSave }: { c: VdClient; onSave: (p: Record<string, unknown>) => void }) {
  const [f, setF] = useState({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", taxId: c.taxId ?? "", address: c.address ?? "", storeUrl: c.storeUrl ?? "", coach: c.coach ?? "", contractDate: toDateInputValue(c.contractDate) });
  const dirty = f.name !== c.name || f.email !== (c.email ?? "") || f.phone !== (c.phone ?? "") || f.taxId !== (c.taxId ?? "") || f.address !== (c.address ?? "") || f.storeUrl !== (c.storeUrl ?? "") || f.coach !== (c.coach ?? "");
  return (
    <Panel title="Dati per il contratto">
      <div className="space-y-3">
        <Field label="Nome / ragione sociale"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Codice fiscale / P.IVA"><input className={inputCls} value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} /></Field>
        <Field label="Indirizzo"><input className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><input className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Telefono"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
        <Field label="Link dello store"><input className={inputCls} placeholder="https://…" value={f.storeUrl} onChange={(e) => setF({ ...f, storeUrl: e.target.value })} /></Field>
        <Field label="Coach"><input className={inputCls} value={f.coach} onChange={(e) => setF({ ...f, coach: e.target.value })} /></Field>
        <div className="flex items-center justify-between gap-2">
          <span className="flex gap-1">
            {c.phone && <a className="inline-flex size-8 items-center justify-center rounded-lg border hover:bg-accent" href={`tel:${c.phone}`} aria-label="Chiama"><Phone className="size-4" /></a>}
            {c.storeUrl && <a className="inline-flex size-8 items-center justify-center rounded-lg border hover:bg-accent" href={c.storeUrl} target="_blank" rel="noreferrer" aria-label="Apri store"><ExternalLink className="size-4" /></a>}
          </span>
          <Button size="sm" disabled={!dirty} onClick={() => onSave({ name: f.name, email: f.email, phone: f.phone, taxId: f.taxId, address: f.address, storeUrl: f.storeUrl, coach: f.coach })}>Salva</Button>
        </div>
      </div>
    </Panel>
  );
}
