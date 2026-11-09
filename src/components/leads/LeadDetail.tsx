"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  PhoneCall,
  Pencil,
  Trash2,
  MoreHorizontal,
  CalendarClock,
  Megaphone,
  ClipboardList,
  History,
  Handshake,
  Loader2,
  StickyNote,
  Phone,
  Mail,
  Building2,
  Sparkles,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ContactAvatar } from "@/components/shared/ContactAvatar";
import { formatCurrencyShort } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  LEAD_STATUSES,
  LEAD_STATUS_CONFIG,
  LEAD_SOURCE_LABELS,
  OUTCOME_CONFIG,
  isCallOutcome,
  splitFormData,
  type Lead,
  type LeadEvent,
  type LeadStatus,
} from "@/lib/leads/types";
import { LeadStatusPill, QuickContact, datePresets, dueText, shortDuration, toLocalInput, waitTone } from "./lead-ui";
import { OutcomeDialog } from "./OutcomeDialog";
import { LeadFormDialog, LostReasonDialog } from "./LeadDialogs";

const fullFmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const shortFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

const CONTEXT_LABELS: Record<string, string> = {
  campaign: "Campagna",
  adset: "Gruppo di inserzioni",
  ad: "Inserzione",
  form: "Modulo",
  page: "Pagina",
  platform: "Piattaforma",
  is_organic: "Organico",
  created_time: "Compilato il",
  utm: "UTM",
};

export function LeadDetail({
  lead: serverLead,
  events: serverEvents,
  nowMs,
  isAdmin,
  userFirstName,
}: {
  lead: Lead;
  events: LeadEvent[];
  nowMs: number;
  isAdmin: boolean;
  userFirstName: string | null;
}) {
  const router = useRouter();
  const [lead, setLead] = useState(serverLead);
  const [prevServer, setPrevServer] = useState(serverLead);
  const [now, setNow] = useState(nowMs);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [notes, setNotes] = useState(serverLead.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  if (prevServer !== serverLead) {
    setPrevServer(serverLead);
    setLead(serverLead);
    setNotes(serverLead.notes ?? "");
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const refreshWith = (l: Lead) => {
    setLead(l);
    router.refresh();
  };

  async function patch(body: Record<string, unknown>, ok?: string) {
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Errore nel salvataggio");
      return null;
    }
    if (ok) toast.success(ok);
    refreshWith(data as Lead);
    return data as Lead;
  }

  async function setStatus(s: LeadStatus) {
    if (s === lead.status) return;
    if (s === "perso") return setLostOpen(true);
    await patch({ status: s }, `Stato: ${LEAD_STATUS_CONFIG[s].label}`);
  }

  async function saveNotes() {
    setSavingNotes(true);
    await patch({ notes }, "Note salvate");
    setSavingNotes(false);
  }

  async function remove() {
    if (!confirm(`Eliminare definitivamente il lead ${lead.name}? Si perde anche la cronologia.`)) return;
    const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Non sono riuscito a eliminare il lead");
    toast.success("Lead eliminato");
    router.push("/leads");
  }

  const waited = now - Date.parse(lead.createdAt);
  const { context, answers } = splitFormData(lead.formData);
  const ctx: Array<[string, string]> = [
    ["Fonte", LEAD_SOURCE_LABELS[lead.source] ?? lead.source],
    ...(Object.entries({ campaign: lead.campaign, adset: lead.adset, ad: lead.ad, form: lead.formName, platform: lead.platform, ...context })
      .filter(([k, v], i, arr) => v && arr.findIndex(([k2]) => k2 === k) === i)
      .map(([k, v]) => [CONTEXT_LABELS[k] ?? k, String(v)] as [string, string])),
  ];

  return (
    <div className="space-y-5">
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Tutti i lead
      </Link>

      {/* Header */}
      <section className="rounded-xl border bg-card p-4 shadow-card md:p-5">
        <div className="flex items-start gap-3.5">
          <ContactAvatar name={lead.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-extrabold tracking-tight md:text-2xl">{lead.name}</h1>
              <StatusMenu status={lead.status} onPick={setStatus} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[lead.company, lead.service].filter(Boolean).join(" · ") || "Nessuna azienda indicata"}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Arrivato {shortFmt.format(Date.parse(lead.createdAt))}</span>
              {lead.status === "nuovo" ? (
                <span className={cn("inline-flex h-5 items-center rounded-full px-1.5 font-semibold ring-1 ring-inset", waitTone(waited))}>
                  In attesa da {shortDuration(waited)}
                </span>
              ) : lead.firstContactAt ? (
                <span>Prima chiamata dopo {shortDuration(Date.parse(lead.firstContactAt) - Date.parse(lead.createdAt))}</span>
              ) : null}
              {lead.callAttempts > 0 && <span>{lead.callAttempts} tentativ{lead.callAttempts === 1 ? "o" : "i"}</span>}
              {lead.value ? <span className="font-semibold text-foreground">{formatCurrencyShort(lead.value)}</span> : null}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Altre azioni" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil />
                Modifica dati
              </DropdownMenuItem>
              {lead.phone && (
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(lead.phoneE164 || lead.phone!).then(() => toast.success("Numero copiato"))}>
                  <Copy />
                  Copia numero
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={remove}>
                    <Trash2 />
                    Elimina lead
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <QuickContact lead={lead} senderFirstName={userFirstName} onCall={() => setTimeout(() => setOutcomeOpen(true), 900)} />
          <Button variant="outline" className="h-10 px-3.5" onClick={() => setOutcomeOpen(true)}>
            <PhoneCall />
            Registra esito
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <NextStepCard lead={lead} now={now} onSave={(iso, note) => patch({ nextActionAt: iso, nextActionNote: note }, iso ? "Prossimo contatto salvato" : "Prossimo contatto rimosso")} />

          <Card icon={ClipboardList} title="Risposte del modulo">
            {answers.length ? (
              <dl className="divide-y">
                {answers.map(([q, a]) => (
                  <div key={q} className="py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-xs font-medium text-muted-foreground">{q}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm">{a}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna risposta aggiuntiva oltre ai dati di contatto.</p>
            )}
          </Card>

          <Timeline leadId={lead.id} events={serverEvents} onAdded={() => router.refresh()} />
        </div>

        <div className="space-y-5">
          <Card icon={Phone} title="Contatto" action={<Button variant="ghost" size="xs" onClick={() => setEditOpen(true)}><Pencil />Modifica</Button>}>
            <dl className="space-y-2.5 text-sm">
              <Row icon={Phone} label="Telefono">
                {lead.phone ? <a className="font-medium hover:text-primary" href={`tel:${(lead.phoneE164 || lead.phone).replace(/\s+/g, "")}`}>{lead.phone}</a> : "—"}
                {lead.phone && !lead.phoneE164 && <span className="ml-1.5 text-xs text-amber-600">numero da verificare</span>}
              </Row>
              <Row icon={Mail} label="Email">
                {lead.email ? <a className="break-all hover:text-primary" href={`mailto:${lead.email}`}>{lead.email}</a> : "—"}
              </Row>
              <Row icon={Building2} label="Azienda">{lead.company || "—"}</Row>
              <Row icon={Sparkles} label="Interesse">{lead.service || "—"}</Row>
            </dl>
          </Card>

          <Card icon={Megaphone} title="Provenienza">
            <dl className="space-y-2 text-sm">
              {ctx.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 truncate text-right font-medium" title={v}>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card icon={StickyNote} title="Note interne">
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Budget, decisore, esigenze, obiezioni…" />
            {notes !== (lead.notes ?? "") && (
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                  {savingNotes && <Loader2 className="animate-spin" />}
                  Salva note
                </Button>
              </div>
            )}
          </Card>

          {isAdmin && <ConvertCard lead={lead} onDone={refreshWith} />}
        </div>
      </div>

      <OutcomeDialog lead={lead} open={outcomeOpen} onOpenChange={setOutcomeOpen} onSaved={refreshWith} />
      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} onSaved={refreshWith} />
      <LostReasonDialog
        open={lostOpen}
        leadName={lead.name}
        onCancel={() => setLostOpen(false)}
        onConfirm={async (reason) => {
          setLostOpen(false);
          await patch({ status: "perso", lostReason: reason }, "Segnato come perso");
        }}
      />
    </div>
  );
}

function Card({ icon: Icon, title, action, children }: { icon: typeof Phone; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card shadow-card">
      <header className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

function StatusMenu({ status, onPick }: { status: LeadStatus; onPick: (s: LeadStatus) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Cambia stato" />}>
        <LeadStatusPill status={status} className="cursor-pointer hover:bg-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Sposta in</DropdownMenuLabel>
        {LEAD_STATUSES.map((s) => (
          <DropdownMenuItem key={s} onClick={() => onPick(s)} className={cn(s === status && "font-semibold")}>
            <span className="size-2 rounded-full" style={{ backgroundColor: LEAD_STATUS_CONFIG[s].color }} />
            {LEAD_STATUS_CONFIG[s].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NextStepCard({ lead, now, onSave }: { lead: Lead; now: number; onSave: (iso: string | null, note: string | null) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const open = LEAD_STATUS_CONFIG[lead.status].open;
  const due = lead.nextActionAt ? dueText(lead.nextActionAt, now) : null;

  function start() {
    setWhen(lead.nextActionAt ? toLocalInput(new Date(lead.nextActionAt)) : "");
    setNote(lead.nextActionNote ?? "");
    setEditing(true);
  }

  if (!open) {
    return (
      <Card icon={CalendarClock} title="Prossimo passo">
        <p className="text-sm text-muted-foreground">
          {lead.status === "vinto" ? "Lead vinto: nessun richiamo da fare." : `Lead perso${lead.lostReason ? ` · ${lead.lostReason}` : ""}.`}
        </p>
      </Card>
    );
  }

  return (
    <Card
      icon={CalendarClock}
      title="Prossimo passo"
      action={!editing && <Button variant="ghost" size="xs" onClick={start}><Pencil />{lead.nextActionAt ? "Cambia" : "Fissa"}</Button>}
    >
      {!editing ? (
        lead.nextActionAt ? (
          <div className="flex items-center gap-3">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", due?.overdue ? "bg-rose-500/12 text-rose-600" : "bg-primary/10 text-primary")}>
              <CalendarClock className="size-5" />
            </span>
            <div>
              <p className={cn("text-sm font-semibold", due?.overdue && "text-rose-600 dark:text-rose-400")}>{due?.text}</p>
              <p className="text-xs text-muted-foreground">
                {fullFmt.format(Date.parse(lead.nextActionAt))}
                {lead.nextActionNote ? ` · ${lead.nextActionNote}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {lead.status === "nuovo" ? "Prima chiamata da fare. Dopo la chiamata registra l'esito: il prossimo passo si imposta da lì." : "Nessun richiamo fissato: decidi quando risentirlo."}
          </p>
        )
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {datePresets().map((p) => (
              <button key={p.label} type="button" onClick={() => setWhen(toLocalInput(p.date))} className="h-7 rounded-md border bg-card px-2 text-xs font-medium hover:bg-muted">
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-10 w-full rounded-lg border bg-card px-3 text-sm shadow-card outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Cosa fare (es. mandare preventivo, richiamare il titolare)"
            className="h-10 w-full rounded-lg border bg-card px-3 text-sm shadow-card outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
          />
          <div className="flex justify-end gap-2">
            {lead.nextActionAt && (
              <Button variant="ghost" size="sm" className="mr-auto text-muted-foreground" onClick={async () => { await onSave(null, null); setEditing(false); }}>
                Rimuovi
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Annulla</Button>
            <Button size="sm" disabled={!when} onClick={async () => { await onSave(new Date(when).toISOString(), note.trim() || null); setEditing(false); }}>
              Salva
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function eventTitle(e: LeadEvent): string {
  if (e.type === "created") return "Lead arrivato";
  if (e.type === "call") return isCallOutcome(e.outcome) ? `Chiamata: ${OUTCOME_CONFIG[e.outcome].label}` : "Chiamata";
  if (e.type === "status")
    return `Stato: ${LEAD_STATUS_CONFIG[e.toStatus as LeadStatus]?.label ?? e.toStatus}`;
  if (e.type === "converted") return "Passato al CRM";
  if (e.type === "edit") return "Prossimo contatto";
  return "Nota";
}

function Timeline({ leadId, events, onAdded }: { leadId: string; events: LeadEvent[]; onAdded: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!note.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/leads/${leadId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Non sono riuscito ad aggiungere la nota");
    setNote("");
    onAdded();
  }

  return (
    <Card icon={History} title="Cronologia">
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Aggiungi una nota…"
          className="h-9 min-w-0 flex-1 rounded-lg border bg-card px-3 text-sm shadow-card outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
        />
        <Button onClick={add} disabled={saving || !note.trim()} className="h-9">
          {saving && <Loader2 className="animate-spin" />}
          Aggiungi
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ancora nessuna attività.</p>
      ) : (
        <ol className="relative space-y-4 border-l pl-5">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-card",
                  e.type === "call" ? "bg-primary" : e.type === "created" ? "bg-sky-500" : e.type === "converted" ? "bg-emerald-500" : "bg-muted-foreground/50"
                )}
              />
              <p className="text-sm font-medium">{eventTitle(e)}</p>
              {e.note && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{e.note}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground/80">
                {shortFmt.format(Date.parse(e.createdAt))}
                {e.actorName ? ` · ${e.actorName}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function ConvertCard({ lead, onDone }: { lead: Lead; onDone: (l: Lead) => void }) {
  const [busy, setBusy] = useState(false);
  const [valueEur, setValueEur] = useState(lead.value ? String(Math.round(lead.value / 100)) : "");

  if (lead.dealId && lead.dealElsewhere) {
    return (
      <Card icon={Handshake} title="Nel CRM">
        <p className="text-sm text-muted-foreground">
          Già convertito in trattativa nel <span className="font-medium text-foreground">{lead.dealElsewhere}</span>.
        </p>
      </Card>
    );
  }

  if (lead.dealId) {
    return (
      <Card icon={Handshake} title="Nel CRM">
        <div className="flex flex-col gap-2 text-sm">
          <Link href={`/deals/${lead.dealId}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
            Apri la trattativa <ExternalLink className="size-3.5" />
          </Link>
          {lead.contactId && (
            <Link href={`/contacts/${lead.contactId}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              Scheda contatto <ExternalLink className="size-3.5" />
            </Link>
          )}
        </div>
      </Card>
    );
  }

  async function convert() {
    setBusy(true);
    try {
      const value = valueEur.trim() ? Math.round(parseFloat(valueEur.replace(/\./g, "").replace(",", ".")) * 100) : null;
      const res = await fetch(`/api/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value != null && !Number.isNaN(value) ? value : null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error);
      toast.success("Trattativa creata nel CRM");
      onDone(data.lead as Lead);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Non sono riuscito a creare la trattativa");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={Handshake} title="Passa al CRM">
      <p className="mb-3 text-sm text-muted-foreground">Crea contatto e trattativa nella pipeline principale, con i dati di questo lead.</p>
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          placeholder="Valore € (facoltativo)"
          value={valueEur}
          onChange={(e) => setValueEur(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-lg border bg-card px-3 text-sm shadow-card outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
        />
        <Button onClick={convert} disabled={busy} className="h-9">
          {busy ? <Loader2 className="animate-spin" /> : <Handshake />}
          Crea trattativa
        </Button>
      </div>
    </Card>
  );
}
