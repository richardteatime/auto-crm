"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fillTemplate, AUTO_INFO, AUTO_KEYS, type AutoKey, type VendioraSettings } from "@/lib/vendiora/types";
import { api, Field, Panel, inputCls, textareaCls } from "./ui";
import { WaConnection } from "./WaConnection";
import { PlaybookSettingsPanel } from "./PlaybookSettingsPanel";

export function VendioraSettingsPanel() {
  const [s, setS] = useState<VendioraSettings | null>(null);
  const [team, setTeam] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ settings: VendioraSettings; team: Array<{ id: string; name: string }> }>("/api/vendiora/settings")
      .then((r) => { setS(r.settings); setTeam(r.team); })
      .catch((e) => toast.error(e.message));
  }, []);

  if (!s) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>;
  const bot = s.bot, co = s.company;
  const setBot = (p: Partial<typeof bot>) => setS({ ...s, bot: { ...bot, ...p } });
  const setCo = (p: Partial<typeof co>) => setS({ ...s, company: { ...co, ...p } });
  const au = s.automations;
  const setAuto = (k: AutoKey, p: Partial<(typeof au)[AutoKey]>) => setS({ ...s, automations: { ...au, [k]: { ...au[k], ...p } } });
  const sample: Record<string, string> = {
    nome: "Marco", referente: bot.handoffName || "il nostro team", prenota: bot.coachingBookingUrl || bot.calendlyUrl || "[link prenotazione]",
    pacchetto: "Store Pro", prezzo: "1.797 €", link: "https://…/offerta/…", scadenza: "18 novembre 2026", contratto: "VO-2026-001",
    call: "Call di avvio", data: "giovedì 19 novembre", ora: "15:00", store: "https://negozio-marco.it",
  };

  async function save() {
    setBusy(true);
    try {
      const r = await api<{ settings: VendioraSettings }>("/api/vendiora/settings", { method: "PUT", json: s });
      setS(r.settings);
      toast.success("Salvato");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const v = { nome: "Marco", referente: bot.handoffName || "il nostro team", link: bot.calendlyUrl || "", n: String(bot.questions.length) };
  const preview = [fillTemplate(bot.greeting, v) + (bot.questions[0] ? `\n\n${bot.questions[0]}` : ""), ...bot.questions.slice(1), fillTemplate(bot.closing, v)];

  return (
    <div className="space-y-6 pb-16">
      <PageHeader title="Bot e azienda" description="Collegamento WhatsApp, bot ai nuovi lead, messaggi automatici del percorso cliente e dati per i contratti." actions={<Button onClick={save} disabled={busy}>{busy ? "Salvo…" : "Salva modifiche"}</Button>} />

      <Panel title="WhatsApp"><WaConnection /></Panel>

      <PlaybookSettingsPanel s={s} setS={setS} team={team} />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel
          title={s.playbook.enabled ? "Bot semplice (spento: è attivo il playbook)" : "Bot di primo contatto"}
          action={
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-4 accent-orange-500" checked={bot.enabled} onChange={(e) => setBot({ enabled: e.target.checked })} />
              {bot.enabled ? "Acceso" : "Spento"}
            </label>
          }
        >
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">Appena arriva un lead col numero, il bot gli scrive, fa le domande una alla volta, poi manda il link per prenotare la call e avvisa chi segui sotto. Se qualcuno risponde a mano (dal CRM o dal telefono) il bot si ferma per quella chat. Segnaposto: <code>{"{nome}"}</code> <code>{"{referente}"}</code> <code>{"{link}"}</code> <code>{"{n}"}</code>.</p>
            <Field label="Primo messaggio"><textarea className={textareaCls} value={bot.greeting} onChange={(e) => setBot({ greeting: e.target.value })} /></Field>
            <div className="space-y-2">
              <p className="text-[12.5px] font-semibold">Domande (una alla volta)</p>
              {bot.questions.map((q, i) => (
                <div key={i} className="flex gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right text-xs font-bold text-muted-foreground">{i + 1}.</span>
                  <input className={inputCls} value={q} onChange={(e) => setBot({ questions: bot.questions.map((x, j) => (j === i ? e.target.value : x)) })} />
                  <Button variant="ghost" size="icon" aria-label="Togli domanda" onClick={() => setBot({ questions: bot.questions.filter((_, j) => j !== i) })}><Trash2 /></Button>
                </div>
              ))}
              {bot.questions.length < 10 && <Button variant="outline" size="sm" onClick={() => setBot({ questions: [...bot.questions, ""] })}><Plus /> Aggiungi domanda</Button>}
            </div>
            <Field label="Messaggio finale"><textarea className={textareaCls} value={bot.closing} onChange={(e) => setBot({ closing: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Link per prenotare la call conoscitiva" hint="Calendly, Google Calendar, ecc."><input className={inputCls} placeholder="https://calendly.com/…" value={bot.calendlyUrl} onChange={(e) => setBot({ calendlyUrl: e.target.value })} /></Field>
              <Field label="Nome di chi fa la call" hint="Usato al posto di {referente}"><input className={inputCls} value={bot.handoffName} onChange={(e) => setBot({ handoffName: e.target.value })} /></Field>
            </div>
            <Field label="Chi riceve l'avviso quando il lead ha risposto" hint="Notifica push e nella campanella del CRM.">
              <div className="flex flex-wrap gap-2 pt-0.5">
                {team.map((u) => {
                  const on = bot.handoffUserIds.includes(u.id);
                  return (
                    <button key={u.id} type="button" onClick={() => setBot({ handoffUserIds: on ? bot.handoffUserIds.filter((x) => x !== u.id) : [...bot.handoffUserIds, u.id] })}
                      className={"rounded-full border px-3 py-1 text-[13px] font-medium transition-colors " + (on ? "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300" : "hover:bg-accent")}>
                      {u.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </Panel>
        <Panel title="Anteprima chat">
          <div className="space-y-2 rounded-lg bg-[#efeae2] p-3 dark:bg-[#0b141a]">
            {preview.map((m, i) => (
              <div key={i} className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
                {m}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">Tra un messaggio e l&apos;altro il bot aspetta la risposta del lead.</p>
        </Panel>
      </div>

      <Panel title="Messaggi automatici su WhatsApp">
        <p className="mb-4 text-[13px] text-muted-foreground">Partono dal numero WhatsApp collegato sopra, ognuno una sola volta per cliente. Se WhatsApp non è collegato o il cliente non ha il numero, non parte niente (lo vedi scritto nella scheda). Togli la spunta per spegnere un messaggio.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {AUTO_KEYS.map((k) => (
            <div key={k} className={`rounded-xl border p-3.5 ${au[k].enabled ? "" : "opacity-60"}`}>
              <label className="mb-1 flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="size-4 accent-orange-500" checked={au[k].enabled} onChange={(e) => setAuto(k, { enabled: e.target.checked })} />
                {AUTO_INFO[k].label}
              </label>
              <p className="mb-2 text-[12.5px] text-muted-foreground">{AUTO_INFO[k].when}. Segnaposto: <code className="text-[11.5px]">{AUTO_INFO[k].vars}</code></p>
              <textarea className={textareaCls} rows={5} value={au[k].text} onChange={(e) => setAuto(k, { text: e.target.value })} />
              <details className="mt-2 text-[12.5px]">
                <summary className="cursor-pointer text-muted-foreground">Anteprima</summary>
                <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-emerald-500/10 p-2.5">{fillTemplate(au[k].text, sample)}</p>
              </details>
            </div>
          ))}
        </div>
        <div className="mt-4 max-w-xs">
          <Field label="Validità delle offerte (giorni)"><input className={inputCls} inputMode="numeric" value={String(au.offerValidDays)} onChange={(e) => setS({ ...s, automations: { ...au, offerValidDays: Number(e.target.value.replace(/\D/g, "")) || 0 } })} /></Field>
        </div>
      </Panel>

      <Panel title="Dati di VendiOra per i contratti">
        <p className="mb-4 text-[13px] text-muted-foreground">Compaiono come «Fornitore». Quelli vuoti escono nel contratto evidenziati in giallo come «da inserire».</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Ragione sociale"><input className={inputCls} value={co.name} onChange={(e) => setCo({ name: e.target.value })} /></Field>
          <Field label="Forma giuridica" hint="es. S.r.l., ditta individuale, LLC"><input className={inputCls} value={co.legalForm} onChange={(e) => setCo({ legalForm: e.target.value })} /></Field>
          <Field label="P.IVA / numero di registrazione"><input className={inputCls} value={co.ein} onChange={(e) => setCo({ ein: e.target.value })} /></Field>
          <Field label="Sede (indirizzo)" className="lg:col-span-2"><input className={inputCls} value={co.address} onChange={(e) => setCo({ address: e.target.value })} /></Field>
          <Field label="Paese / Stato"><input className={inputCls} value={co.state} onChange={(e) => setCo({ state: e.target.value })} /></Field>
          <Field label="Legale rappresentante"><input className={inputCls} value={co.representative} onChange={(e) => setCo({ representative: e.target.value })} /></Field>
          <Field label="Ruolo"><input className={inputCls} value={co.representativeRole} onChange={(e) => setCo({ representativeRole: e.target.value })} /></Field>
          <Field label="Email"><input className={inputCls} value={co.email} onChange={(e) => setCo({ email: e.target.value })} /></Field>
          <Field label="Telefono"><input className={inputCls} value={co.phone} onChange={(e) => setCo({ phone: e.target.value })} /></Field>
          <Field label="IBAN / coordinate di pagamento" className="lg:col-span-2"><input className={inputCls} value={co.bank} onChange={(e) => setCo({ bank: e.target.value })} /></Field>
          <Field label="Foro competente (città)"><input className={inputCls} value={co.court} onChange={(e) => setCo({ court: e.target.value })} /></Field>
        </div>
      </Panel>
      <div className="flex justify-end"><Button onClick={save} disabled={busy}>{busy ? "Salvo…" : "Salva modifiche"}</Button></div>
    </div>
  );
}
