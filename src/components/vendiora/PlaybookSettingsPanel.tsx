"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TASK_ROLES, TASK_ROLE_LABELS, eur, type PlaybookSettings, type VendioraSettings } from "@/lib/vendiora/types";
import { api, Field, Panel, Pill, inputCls, textareaCls } from "./ui";

type Msg = { id: string; group: string; when: string; channel: "wa" | "email" | "task"; role?: string; title?: string; text: string };
type Pkg = { code: string; name: string; price: number; durationLabel: string; line: string; calls: { code: string; title: string; when: string }[] };

const LINKS: { k: keyof PlaybookSettings["links"]; label: string; hint?: string }[] = [
  { k: "salesBooking", label: "Prenotazione call di vendita", hint: "{link} di M1 e M2" },
  { k: "salesCall", label: "Link della call di vendita (Meet/Zoom)" },
  { k: "csmBooking", label: "Prenotazione call di onboarding (CSM)" },
  { k: "coachBooking", label: "Prenotazione call con il coach" },
  { k: "pmBooking", label: "Prenotazione call con il PM (DFY)" },
  { k: "whatsappGroup", label: "Invito al gruppo WhatsApp clienti" },
  { k: "intakeForm", label: "Intake form (Consulenza)" },
  { k: "briefForm", label: "Brief di progetto (DFY)" },
  { k: "preCallForm", label: "Form pre-call" },
  { k: "resultsForm", label: "Form risultati e testimonianza" },
  { k: "welcomeVideo", label: "Video di benvenuto" },
  { k: "preframeVideo", label: "Video pre-call (preframe)" },
  { k: "freeContent", label: "Contenuto gratuito (nurturing)" },
  { k: "caseStudy", label: "Caso studio" },
  { k: "review", label: "Recensione Google / Trustpilot" },
  { k: "referral", label: "Pagina referral", hint: "Al link viene aggiunto il codice del cliente" },
  { k: "referralReward", label: "Premio referral", hint: "Testo, es. «una call extra»" },
  { k: "privacy", label: "Informativa privacy" },
];

/** Settings → Playbook: on/off, team per role, links, contract data, message texts (M1–M10), Fathom */
export function PlaybookSettingsPanel({ s, setS, team }: { s: VendioraSettings; setS: (s: VendioraSettings) => void; team: { id: string; name: string }[] }) {
  const pb = s.playbook;
  const set = (p: Partial<PlaybookSettings>) => setS({ ...s, playbook: { ...pb, ...p } });
  const [cat, setCat] = useState<{ messages: Msg[]; groups: Record<string, string>; packages: Pkg[] } | null>(null);
  const [group, setGroup] = useState("M1");
  const [seeding, setSeeding] = useState(false);
  useEffect(() => { api<{ messages: Msg[]; groups: Record<string, string>; packages: Pkg[] }>("/api/vendiora/playbook").then(setCat).catch(() => {}); }, []);
  const msgs = useMemo(() => cat?.messages.filter((m) => m.group === group) ?? [], [cat, group]);
  const hook = typeof window !== "undefined" ? `${window.location.origin}/api/vendiora/fathom?secret=${pb.fathomSecret || "…"}` : "";
  const missing = LINKS.filter((l) => !pb.links[l.k]).length;

  async function seed() {
    setSeeding(true);
    try {
      const r = await api<{ created: string[]; updated: string[] }>("/api/vendiora/playbook", { json: { action: "seed" } });
      toast.success(`Listino del playbook: ${r.created.length} pacchetti creati, ${r.updated.length} aggiornati`);
    } catch (e) { toast.error((e as Error).message); } finally { setSeeding(false); }
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Playbook Operations & Sales"
        action={
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-4 accent-orange-500" checked={pb.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            {pb.enabled ? "Acceso" : "Spento"}
          </label>
        }
      >
        <div className="space-y-4 text-[13px]">
          <p className="text-muted-foreground">
            Acceso, il CRM segue il playbook al posto del bot semplice: primo messaggio per angle a 3 minuti, 3 domande di qualifica con punteggio, sequenze M1–M10,
            offerta in firma con promemoria a 4/24/48 h, attivazione con il calendario delle call del pacchetto, check-in, scadenze DFY, rate, salute del cliente,
            upsell e task per il team. I messaggi partono solo dall&apos;istanza principale e solo con WhatsApp collegato; quelli con un link vuoto non partono.
          </p>
          {pb.enabled && missing > 0 && <p className="rounded-lg bg-amber-500/10 px-3 py-2 font-medium text-amber-800 dark:text-amber-300">Mancano {missing} link su {LINKS.length}: i messaggi che li usano restano fermi finché non li inserisci.</p>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nome del brand nei messaggi"><input className={inputCls} value={pb.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
            <Field label="Nome del commerciale" hint="{commerciale} nei messaggi"><input className={inputCls} value={pb.commerciale} onChange={(e) => set({ commerciale: e.target.value })} /></Field>
            <div className="flex items-end"><Button variant="outline" onClick={seed} disabled={seeding}><Package /> {seeding ? "Creo…" : "Crea i 5 pacchetti del listino"}</Button></div>
          </div>
          {cat && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {cat.packages.map((p) => (
                <div key={p.code} className="rounded-lg border p-2.5">
                  <p className="text-[11px] font-bold text-orange-600">{p.code}</p>
                  <p className="font-semibold leading-tight">{p.name}</p>
                  <p className="text-[12px] text-muted-foreground">{eur(p.price)} · {p.calls.length} call · {p.durationLabel}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Chi fa cosa (task e avvisi)">
        <p className="mb-3 text-[13px] text-muted-foreground">Ogni task del playbook (chiamate, vocali, escalation) va al ruolo indicato nel documento. Chi è selezionato riceve la notifica push e nella campanella.</p>
        <div className="space-y-3">
          {TASK_ROLES.map((r) => (
            <div key={r} className="flex flex-wrap items-center gap-2">
              <span className="w-36 text-[13px] font-semibold">{TASK_ROLE_LABELS[r]}</span>
              {team.map((u) => {
                const on = pb.team[r].includes(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => set({ team: { ...pb.team, [r]: on ? pb.team[r].filter((x) => x !== u.id) : [...pb.team[r], u.id] } })}
                    className={cn("rounded-full border px-3 py-1 text-[12.5px] font-medium", on ? "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300" : "hover:bg-accent")}>{u.name}</button>
                );
              })}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Link usati nei messaggi">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((l) => (
            <Field key={l.k} label={l.label} hint={l.hint}>
              <input className={cn(inputCls, !pb.links[l.k] && "border-amber-500/50")} placeholder={l.k === "referralReward" ? "una call extra" : "https://…"} value={pb.links[l.k]} onChange={(e) => set({ links: { ...pb.links, [l.k]: e.target.value } })} />
            </Field>
          ))}
        </div>
      </Panel>

      <Panel title="Contratto: dati che non sono nel documento">
        <p className="mb-3 text-[13px] text-muted-foreground">Il testo del contratto è quello dell&apos;«Offerta di fornitura servizi e consulenza» (16 articoli + Allegato A con il solo pacchetto venduto). Qui vanno i dati che nel documento sono vuoti; se mancano escono come [DA INSERIRE].</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Prezzi del listino"><select className={inputCls} value={pb.contract.vat} onChange={(e) => set({ contract: { ...pb.contract, vat: e.target.value as "esclusa" | "inclusa" } })}><option value="esclusa">IVA esclusa</option><option value="inclusa">IVA inclusa</option></select></Field>
          <Field label="Codice fiscale di VendiOra"><input className={inputCls} value={pb.contract.taxCode} onChange={(e) => set({ contract: { ...pb.contract, taxCode: e.target.value } })} /></Field>
          <Field label="PEC"><input className={inputCls} value={pb.contract.pec} onChange={(e) => set({ contract: { ...pb.contract, pec: e.target.value } })} /></Field>
          <Field label="Luogo di firma"><input className={inputCls} value={pb.contract.place} onChange={(e) => set({ contract: { ...pb.contract, place: e.target.value } })} /></Field>
          <Field label="Foro competente"><input className={inputCls} value={pb.contract.court} onChange={(e) => set({ contract: { ...pb.contract, court: e.target.value } })} /></Field>
        </div>
      </Panel>

      <Panel title={`Messaggi del playbook${cat ? ` · ${cat.messages.length}` : ""}`}>
        {!cat ? <p className="text-sm text-muted-foreground">…</p> : (
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
              {Object.entries(cat.groups).map(([g, label]) => {
                const n = cat.messages.filter((m) => m.group === g).length;
                return n ? <button key={g} type="button" onClick={() => setGroup(g)} className={cn("rounded-lg px-2.5 py-1.5 text-left text-[12.5px]", g === group ? "bg-orange-500/10 font-semibold text-orange-700 dark:text-orange-300" : "hover:bg-accent")}>{label} <span className="text-muted-foreground">({n})</span></button> : null;
              })}
            </nav>
            <div className="space-y-3">
              {msgs.map((m) => {
                const ov = pb.messages[m.id] ?? {};
                const off = ov.enabled === false;
                const text = ov.text ?? m.text;
                const setOv = (p: { enabled?: boolean; text?: string }) => {
                  const next = { ...ov, ...p };
                  if (next.enabled !== false) delete next.enabled;
                  if (next.text === undefined || next.text === m.text) delete next.text;
                  const all = { ...pb.messages };
                  if (Object.keys(next).length) all[m.id] = next; else delete all[m.id];
                  set({ messages: all });
                };
                return (
                  <div key={m.id} className={cn("rounded-xl border p-3", off && "opacity-55")}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <input type="checkbox" className="size-4 accent-orange-500" checked={!off} onChange={(e) => setOv({ enabled: e.target.checked ? undefined : false })} aria-label="Attivo" />
                      <Pill tone={m.channel === "task" ? "bg-violet-500/10 text-violet-700 ring-violet-500/25" : m.channel === "email" ? "bg-sky-500/10 text-sky-700 ring-sky-500/25" : "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25"}>
                        {m.channel === "task" ? `Task · ${TASK_ROLE_LABELS[m.role as keyof typeof TASK_ROLE_LABELS] ?? m.role}` : m.channel === "email" ? "Email" : "WhatsApp"}
                      </Pill>
                      <span className="text-[12.5px] font-semibold">{m.title ?? m.when}</span>
                      {m.title && <span className="text-[12px] text-muted-foreground">{m.when}</span>}
                      <code className="ml-auto text-[10.5px] text-muted-foreground">{m.id}</code>
                      {ov.text !== undefined && <Button size="icon-sm" variant="ghost" title="Ripristina il testo del playbook" onClick={() => setOv({ text: undefined })}><RotateCcw /></Button>}
                    </div>
                    <textarea className={textareaCls + " min-h-[64px]"} value={text} onChange={(e) => setOv({ text: e.target.value })} />
                  </div>
                );
              })}
              <p className="text-[11.5px] text-muted-foreground">Segnaposto: {"{nome} {brand} {commerciale} {link} {pacchetto} {prezzo} {call} {data} {ora} {coach} {scadenza} {riepilogo} {compiti}"}. Ricorda di cliccare «Salva modifiche».</p>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Fathom: riassunto delle call nel CRM">
        <div className="space-y-3 text-[13px]">
          <p className="text-muted-foreground">Quando Fathom finisce di elaborare una call la manda qui: il riassunto, i compiti e la registrazione finiscono nella call giusta del cliente (riconosciuta dal codice nel titolo, es. «BASE-C3 – Mario Rossi»), oppure nella scheda del lead per la «SALES-CALL». Funziona con il webhook di Fathom o tramite Zapier/Make.</p>
          <div className="grid gap-3 sm:grid-cols-[260px_1fr]">
            <Field label="Chiave segreta (min. 16 caratteri)"><input className={inputCls} value={pb.fathomSecret} onChange={(e) => set({ fathomSecret: e.target.value.trim() })} placeholder="incolla o genera" /></Field>
            <Field label="Indirizzo da incollare in Fathom"><input readOnly className={inputCls + " font-mono text-[12px]"} value={hook} onFocus={(e) => e.target.select()} /></Field>
          </div>
          {!pb.fathomSecret && <Button size="sm" variant="outline" onClick={() => set({ fathomSecret: Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("") })}>Genera chiave</Button>}
        </div>
      </Panel>
    </div>
  );
}
