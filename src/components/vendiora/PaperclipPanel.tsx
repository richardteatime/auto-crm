"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, ExternalLink, FlaskConical, RefreshCw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaperclipDelivery, VdClient } from "@/lib/vendiora/types";
import { api, Panel, Pill, fmtDate } from "./ui";

type Resp = { configured: boolean; delivery: PaperclipDelivery | null; url: string | null };

const STATUS: Record<string, [string, string]> = {
  backlog: ["In attesa", "bg-slate-100 text-slate-700 ring-slate-200"],
  todo: ["Da iniziare", "bg-slate-100 text-slate-700 ring-slate-200"],
  in_progress: ["In lavorazione", "bg-blue-50 text-blue-700 ring-blue-200"],
  in_review: ["Pronto: da rivedere", "bg-amber-50 text-amber-800 ring-amber-200"],
  blocked: ["Bloccato", "bg-red-50 text-red-700 ring-red-200"],
  done: ["Consegnato", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  cancelled: ["Annullato", "bg-slate-100 text-slate-500 ring-slate-200"],
};

/** Consegna DFY fatta dagli agenti Paperclip (azienda VendiOra) */
export function PaperclipPanel({ c }: { c: VdClient }) {
  const [r, setR] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setR(await api<Resp>(`/api/vendiora/clients/${c.id}/paperclip`)); } catch { setR({ configured: false, delivery: null, url: null }); }
  }, [c.id]);
  useEffect(() => { load(); }, [load]);

  const start = async (test: boolean) => {
    if (!test && !confirm(`Affido la consegna di «${c.name}» agli agenti. Lavorano solo su ricerca, brand, testi, immagini e store in anteprima: non scrivono mai al cliente. Procedo?`)) return;
    setBusy(true);
    try { setR(await api<Resp>(`/api/vendiora/clients/${c.id}/paperclip`, { json: { test } })); toast.success(test ? "Prova avviata" : "Consegna affidata agli agenti"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(false); }
  };

  const d = r?.delivery;
  const [label, tone] = STATUS[d?.status ?? ""] ?? [d?.status ?? "", "bg-slate-100 text-slate-700 ring-slate-200"];
  return (
    <Panel
      title={<span className="inline-flex items-center gap-2"><Bot className="size-4" /> Consegna con gli agenti</span>}
      action={d ? <Button size="sm" variant="ghost" onClick={load} title="Aggiorna"><RefreshCw /></Button> : undefined}
    >
      {!r ? <p className="text-sm text-muted-foreground">Caricamento…</p> : !r.configured ? (
        <p className="text-sm text-muted-foreground">Il collegamento con Paperclip non è attivo su questo CRM.</p>
      ) : !d ? (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">Gli agenti di VendiOra preparano ricerca prodotto, brand, testi, immagini e lo store in anteprima. Tu e Leo pubblicate in call con il cliente.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => start(false)} disabled={busy || !c.isPaid} title={c.isPaid ? "" : "Registra prima il pagamento"}><Rocket /> Affida agli agenti</Button>
            <Button size="sm" variant="outline" onClick={() => start(true)} disabled={busy}><FlaskConical /> Prova (cliente finto)</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={tone}>{label}</Pill>
            {d.test && <Pill tone="bg-violet-50 text-violet-700 ring-violet-200">Prova</Pill>}
            <span className="text-muted-foreground">{d.identifier} · avviata il {fmtDate(d.startedAt)}</span>
            {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Apri su Paperclip <ExternalLink className="size-3" /></a>}
          </div>
          {d.needs.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <p className="font-semibold">Da chiedere al cliente</p>
              <ul className="mt-1 list-disc pl-5">{d.needs.map((n, i) => <li key={i}>{n.text}</li>)}</ul>
            </div>
          )}
          {d.phases.length > 0 ? (
            <ol className="space-y-1">{d.phases.map((p, i) => <li key={i} className="flex gap-2"><span className="text-emerald-600">✓</span><span>{p.label}</span><span className="ml-auto text-muted-foreground">{fmtDate(p.at)}</span></li>)}</ol>
          ) : <p className="text-muted-foreground">Nessuna fase chiusa per ora.</p>}
          {d.lastComment && <p className="line-clamp-4 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-muted-foreground">{d.lastComment.text}</p>}
          {d.error && <p className="text-red-600">Ultimo aggiornamento non riuscito: {d.error}</p>}
        </div>
      )}
    </Panel>
  );
}
