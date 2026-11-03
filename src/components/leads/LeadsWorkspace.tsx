"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  PhoneCall,
  Plus,
  Search,
  Inbox,
  CalendarClock,
  CalendarCheck,
  Trophy,
  Timer,
  ClipboardCheck,
  Megaphone,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/shared/Segmented";
import { PageHeader } from "@/components/shared/PageHeader";
import { useHydrated } from "@/components/shared/ThemeProvider";
import { burstConfetti } from "@/lib/confetti";
import { formatCurrencyShort } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  LEAD_STATUSES,
  LEAD_STATUS_CONFIG,
  LEAD_SOURCE_LABELS,
  type Lead,
  type LeadStatus,
} from "@/lib/leads/types";
import { LeadStatusPill, QuickContact, dueText, shortDuration, waitTone } from "./lead-ui";
import { OutcomeDialog } from "./OutcomeDialog";
import { LeadFormDialog, LostReasonDialog } from "./LeadDialogs";
import { PushNudge } from "./PushControls";

type View = "coda" | "pipeline" | "tutti";
const VIEW_OPTS: Array<{ value: View; label: React.ReactNode }> = [
  { value: "coda", label: "Da chiamare" },
  { value: "pipeline", label: "Pipeline" },
  { value: "tutti", label: "Tutti" },
];

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

const OPEN = new Set<LeadStatus>(["nuovo", "da_richiamare", "appuntamento", "proposta"]);

export function LeadsWorkspace({
  leads: serverLeads,
  nowMs,
  userFirstName,
}: {
  leads: Lead[];
  nowMs: number;
  userFirstName: string | null;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(serverLeads);
  const [prevServer, setPrevServer] = useState(serverLeads);
  const [now, setNow] = useState(nowMs);
  const savedView = useSyncExternalStore(subscribeStorage, () => localStorage.getItem("leads-view"), () => null);
  const [pickedView, setPickedView] = useState<View | null>(null);
  const view: View = pickedView ?? (VIEW_OPTS.some((o) => o.value === savedView) ? (savedView as View) : "coda");
  const [outcomeLead, setOutcomeLead] = useState<Lead | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // Server data wins on every refresh
  if (prevServer !== serverLeads) {
    setPrevServer(serverLeads);
    setLeads(serverLeads);
  }

  // Live timers + pick up new leads without reloading
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    const r = setInterval(() => router.refresh(), 45_000);
    const onFocus = () => {
      setNow(Date.now());
      router.refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      clearInterval(r);
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);

  const changeView = (v: View) => {
    setPickedView(v);
    localStorage.setItem("leads-view", v);
  };

  const onLeadSaved = useCallback(
    (updated: Lead) => {
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      router.refresh();
    },
    [router]
  );

  const kpi = useMemo(() => computeKpis(leads, now), [leads, now]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lead"
        description="I contatti arrivati dalle campagne: chiamali, segna l'esito, fissa il prossimo passo."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus />
            Nuovo lead
          </Button>
        }
      />

      <PushNudge />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi icon={Inbox} tone="text-sky-600 dark:text-sky-400" label="Nuovi da chiamare" value={kpi.fresh} sub={kpi.oldestWait ? `Il più vecchio aspetta da ${kpi.oldestWait}` : "Nessuno in attesa"} />
        <Kpi icon={CalendarClock} tone="text-amber-600 dark:text-amber-400" label="Richiami di oggi" value={kpi.dueToday} sub={kpi.overdue ? `${kpi.overdue} già scadut${kpi.overdue === 1 ? "o" : "i"}` : "In orario"} />
        <Kpi icon={CalendarCheck} tone="text-violet-600 dark:text-violet-400" label="Appuntamenti" value={kpi.appointments} sub={kpi.proposals === 1 ? "1 proposta in attesa" : `${kpi.proposals} proposte in attesa`} />
        <Kpi icon={Trophy} tone="text-emerald-600 dark:text-emerald-400" label="Vinti questo mese" value={kpi.wonMonth} sub={kpi.wonValue ? formatCurrencyShort(kpi.wonValue) : `${kpi.monthLeads} lead arrivati nel mese`} />
      </div>
      <p className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Timer className="size-3.5" />
          Tempo medio alla prima chiamata (30 gg):{" "}
          <strong className="font-semibold text-foreground">{kpi.avgFirstCall ?? "—"}</strong>
        </span>
        <span className="inline-flex items-center gap-1">
          <ClipboardCheck className="size-3.5" />
          Contattati: <strong className="font-semibold text-foreground">{kpi.contactRate}</strong>
        </span>
        <span className="inline-flex items-center gap-1">
          <Megaphone className="size-3.5" />
          Lead nel mese: <strong className="font-semibold text-foreground">{kpi.monthLeads}</strong>
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Vista" options={VIEW_OPTS} value={view} onChange={changeView} />
      </div>

      {view === "coda" && <CallQueue leads={leads} now={now} userFirstName={userFirstName} onOutcome={setOutcomeLead} />}
      {view === "pipeline" && <LeadKanban leads={leads} now={now} onChanged={onLeadSaved} setLeads={setLeads} />}
      {view === "tutti" && <LeadList leads={leads} now={now} />}

      {outcomeLead && (
        <OutcomeDialog
          lead={outcomeLead}
          open={!!outcomeLead}
          onOpenChange={(v) => !v && setOutcomeLead(null)}
          onSaved={onLeadSaved}
        />
      )}
      <LeadFormDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onSaved={(l) => {
          setLeads((prev) => [l, ...prev]);
          router.push(`/leads/${l.id}`);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function computeKpis(leads: Lead[], now: number) {
  const romeDay = (ms: number) => new Date(ms).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
  const romeMonth = (ms: number) => new Date(ms).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", month: "numeric", year: "numeric" });
  const today = romeDay(now);
  const month = romeMonth(now);

  const fresh = leads.filter((l) => l.status === "nuovo");
  const oldest = fresh.reduce((min, l) => Math.min(min, Date.parse(l.createdAt)), Infinity);
  const withDue = leads.filter((l) => OPEN.has(l.status) && l.status !== "nuovo" && l.nextActionAt);
  const dueToday = withDue.filter((l) => romeDay(Date.parse(l.nextActionAt!)) === today || Date.parse(l.nextActionAt!) <= now);
  const overdue = withDue.filter((l) => Date.parse(l.nextActionAt!) <= now);
  const monthLeads = leads.filter((l) => romeMonth(Date.parse(l.createdAt)) === month);
  const wonMonth = leads.filter((l) => l.status === "vinto" && romeMonth(Date.parse(l.updatedAt)) === month);

  const since = now - 30 * 86_400_000;
  const recent = leads.filter((l) => Date.parse(l.createdAt) >= since);
  const firstCalls = recent.filter((l) => l.firstContactAt).map((l) => Date.parse(l.firstContactAt!) - Date.parse(l.createdAt));
  const avg = firstCalls.length ? firstCalls.reduce((a, b) => a + b, 0) / firstCalls.length : null;
  const contacted = recent.filter((l) => l.firstContactAt || l.status !== "nuovo").length;

  return {
    fresh: fresh.length,
    oldestWait: Number.isFinite(oldest) ? shortDuration(now - oldest) : null,
    dueToday: dueToday.length,
    overdue: overdue.length,
    appointments: leads.filter((l) => l.status === "appuntamento").length,
    proposals: leads.filter((l) => l.status === "proposta").length,
    wonMonth: wonMonth.length,
    wonValue: wonMonth.reduce((s, l) => s + (l.value ?? 0), 0),
    monthLeads: monthLeads.length,
    avgFirstCall: avg != null ? shortDuration(avg) : null,
    contactRate: recent.length ? `${Math.round((contacted / recent.length) * 100)}%` : "—",
  };
}

function Kpi({ icon: Icon, tone, label, value, sub }: { icon: typeof Inbox; tone: string; label: string; value: number; sub: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-card">
      <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Icon className={cn("size-4", tone)} />
        {label}
      </span>
      <span className="text-[26px] font-bold leading-none tracking-tight tabular-nums">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Call queue
// ---------------------------------------------------------------------------

function CallQueue({
  leads,
  now,
  userFirstName,
  onOutcome,
}: {
  leads: Lead[];
  now: number;
  userFirstName: string | null;
  onOutcome: (l: Lead) => void;
}) {
  const romeDay = (ms: number) => new Date(ms).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
  const today = romeDay(now);

  const fresh = leads.filter((l) => l.status === "nuovo").sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const open = leads.filter((l) => OPEN.has(l.status) && l.status !== "nuovo");
  const due = open
    .filter((l) => l.nextActionAt && (Date.parse(l.nextActionAt) <= now || romeDay(Date.parse(l.nextActionAt)) === today))
    .sort((a, b) => Date.parse(a.nextActionAt!) - Date.parse(b.nextActionAt!));
  const later = open
    .filter((l) => l.nextActionAt && !due.includes(l))
    .sort((a, b) => Date.parse(a.nextActionAt!) - Date.parse(b.nextActionAt!));
  const noStep = open.filter((l) => !l.nextActionAt).sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));

  if (!fresh.length && !due.length && !later.length && !noStep.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
          <Sparkles className="size-5" />
        </span>
        <p className="text-sm font-semibold">Nessuno da chiamare adesso</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Appena arriva un lead dalle campagne lo trovi qui in cima, con il tempo di attesa. Ti arriva anche una notifica se le hai attivate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <QueueSection title="Nuovi: chiamali subito" hint="dal più vecchio" count={fresh.length} accent="#0ea5e9">
        {fresh.map((l) => (
          <QueueRow key={l.id} lead={l} now={now} userFirstName={userFirstName} onOutcome={onOutcome} mode="wait" />
        ))}
      </QueueSection>
      <QueueSection title="Richiami di oggi" count={due.length} accent="#f59e0b">
        {due.map((l) => (
          <QueueRow key={l.id} lead={l} now={now} userFirstName={userFirstName} onOutcome={onOutcome} mode="due" />
        ))}
      </QueueSection>
      <QueueSection title="Senza prossimo passo" hint="decidi quando risentirli" count={noStep.length} accent="#ef4444">
        {noStep.map((l) => (
          <QueueRow key={l.id} lead={l} now={now} userFirstName={userFirstName} onOutcome={onOutcome} mode="none" />
        ))}
      </QueueSection>
      <QueueSection title="Prossimi giorni" count={later.length} accent="#94a3b8" collapsedAfter={8}>
        {later.map((l) => (
          <QueueRow key={l.id} lead={l} now={now} userFirstName={userFirstName} onOutcome={onOutcome} mode="due" />
        ))}
      </QueueSection>
    </div>
  );
}

function QueueSection({
  title,
  hint,
  count,
  accent,
  children,
  collapsedAfter,
}: {
  title: string;
  hint?: string;
  count: number;
  accent: string;
  children: React.ReactNode[];
  collapsedAfter?: number;
}) {
  const [all, setAll] = useState(false);
  if (count === 0) return null;
  const items = collapsedAfter && !all ? children.slice(0, collapsedAfter) : children;
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="size-2 rounded-full" style={{ backgroundColor: accent }} />
        {title}
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-muted-foreground">{count}</span>
        {hint && <span className="text-xs font-normal text-muted-foreground">· {hint}</span>}
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">{items}</ul>
      {collapsedAfter && count > collapsedAfter && !all && (
        <button type="button" onClick={() => setAll(true)} className="text-xs font-medium text-primary hover:underline">
          Mostra tutti ({count})
        </button>
      )}
    </section>
  );
}

function QueueRow({
  lead,
  now,
  userFirstName,
  onOutcome,
  mode,
}: {
  lead: Lead;
  now: number;
  userFirstName: string | null;
  onOutcome: (l: Lead) => void;
  mode: "wait" | "due" | "none";
}) {
  const waited = now - Date.parse(lead.createdAt);
  const due = lead.nextActionAt ? dueText(lead.nextActionAt, now) : null;
  const subtitle = [lead.company, lead.service].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <Link href={`/leads/${lead.id}`} className="group min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold group-hover:text-primary">{lead.name}</span>
          {mode === "wait" && (
            <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[11px] font-semibold ring-1 ring-inset tabular-nums", waitTone(waited))}>
              <Timer className="size-3" />
              {shortDuration(waited)}
            </span>
          )}
          {mode !== "wait" && <LeadStatusPill status={lead.status} className="h-5 text-[11px]" />}
          {due && mode === "due" && (
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full px-1.5 text-[11px] font-semibold ring-1 ring-inset",
                due.overdue ? "bg-rose-500/12 text-rose-700 ring-rose-500/25 dark:text-rose-300" : "bg-muted text-muted-foreground ring-border"
              )}
            >
              {due.text}
            </span>
          )}
          {lead.callAttempts > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {lead.callAttempts} tentativ{lead.callAttempts === 1 ? "o" : "i"}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {subtitle || lead.phone || lead.email}
          {lead.nextActionNote && mode !== "wait" ? ` — ${lead.nextActionNote}` : ""}
        </p>
        {mode === "wait" && (lead.campaign || lead.source) && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
            {LEAD_SOURCE_LABELS[lead.source] ?? lead.source}
            {lead.campaign ? ` · ${lead.campaign}` : ""}
          </p>
        )}
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        <QuickContact lead={lead} senderFirstName={userFirstName} compact onCall={() => setTimeout(() => onOutcome(lead), 900)} />
        <Button variant="outline" className="h-9" onClick={() => onOutcome(lead)}>
          <PhoneCall />
          Esito
        </Button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Kanban
// ---------------------------------------------------------------------------

const kanbanCollision: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length > 0 ? under : rectIntersection(args);
};

function LeadKanban({
  leads,
  now,
  onChanged,
  setLeads,
}: {
  leads: Lead[];
  now: number;
  onChanged: (l: Lead) => void;
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lostAsk, setLostAsk] = useState<{ lead: Lead; prev: LeadStatus } | null>(null);
  const [search, setSearch] = useState("");
  const lastDrop = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } })
  );

  const q = search.trim().toLowerCase();
  const visible = q
    ? leads.filter((l) => [l.name, l.company, l.service, l.phone, l.email].some((v) => v?.toLowerCase().includes(q)))
    : leads;
  const byStatus = (s: LeadStatus) =>
    visible
      .filter((l) => l.status === s)
      .sort((a, b) =>
        s === "nuovo" ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      );

  async function move(lead: Lead, to: LeadStatus, extra: Record<string, unknown> = {}) {
    const prev = lead.status;
    setLeads((all) => all.map((l) => (l.id === lead.id ? { ...l, status: to } : l)));
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, ...extra }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as Lead;
      onChanged(updated);
      if (to === "vinto") {
        burstConfetti();
        toast.success("Lead vinto!", { description: lead.name, icon: <Trophy className="size-4 text-emerald-500" /> });
      } else toast(`Spostato in «${LEAD_STATUS_CONFIG[to].label}»`, { description: lead.name });
    } catch {
      setLeads((all) => all.map((l) => (l.id === lead.id ? { ...l, status: prev } : l)));
      toast.error("Non sono riuscito a spostare il lead");
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    lastDrop.current = Date.now();
    const lead = leads.find((l) => l.id === e.active.id);
    if (!lead || !e.over) return;
    const overId = String(e.over.id);
    const to = (LEAD_STATUSES as readonly string[]).includes(overId)
      ? (overId as LeadStatus)
      : leads.find((l) => l.id === overId)?.status;
    if (!to || to === lead.status) return;
    if (to === "perso") {
      setLeads((all) => all.map((l) => (l.id === lead.id ? { ...l, status: "perso" } : l)));
      setLostAsk({ lead, prev: lead.status });
      return;
    }
    move(lead, to);
  }

  const active = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Cerca lead…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg border bg-card pl-9 pr-3 text-sm shadow-card outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
          />
        </div>
        <span className="ml-auto text-xs text-muted-foreground">Trascina una scheda per cambiare stato</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={kanbanCollision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin md:-mx-8 md:snap-none md:px-8">
          {LEAD_STATUSES.map((s) => (
            <KanbanCol key={s} status={s} leads={byStatus(s)} now={now} onOpen={(id) => Date.now() - lastDrop.current > 300 && router.push(`/leads/${id}`)} />
          ))}
        </div>
        {hydrated &&
          createPortal(
            <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
              {active ? <LeadCard lead={active} now={now} overlay /> : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>
      <LostReasonDialog
        open={!!lostAsk}
        leadName={lostAsk?.lead.name ?? ""}
        onCancel={() => {
          if (lostAsk) setLeads((all) => all.map((l) => (l.id === lostAsk.lead.id ? { ...l, status: lostAsk.prev } : l)));
          setLostAsk(null);
        }}
        onConfirm={(reason) => {
          if (lostAsk) move({ ...lostAsk.lead, status: lostAsk.prev }, "perso", { lostReason: reason });
          setLostAsk(null);
        }}
      />
    </div>
  );
}

function KanbanCol({ status, leads, now, onOpen }: { status: LeadStatus; leads: Lead[]; now: number; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = LEAD_STATUS_CONFIG[status];
  const value = leads.reduce((s, l) => s + (l.value ?? 0), 0);
  return (
    <section
      ref={setNodeRef}
      aria-label={`${cfg.label}: ${leads.length} lead`}
      className={cn(
        "flex w-[min(86vw,272px)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-muted/45 md:w-auto md:min-w-[210px] md:flex-1 md:shrink transition-[background-color,border-color,box-shadow] dark:bg-muted/30",
        isOver && "border-primary/45 bg-primary/[0.05] ring-4 ring-primary/10"
      )}
    >
      <div className="h-[3px]" style={{ backgroundColor: cfg.color }} />
      <header className="flex items-center gap-2 px-3 pb-2 pt-2.5">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: cfg.color }} />
        <h2 className="truncate text-[13px] font-semibold">{cfg.label}</h2>
        <span className="rounded-full bg-background px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-muted-foreground ring-1 ring-border">
          {leads.length}
        </span>
        {value > 0 && <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">{formatCurrencyShort(value)}</span>}
      </header>
      <div className="flex min-h-[140px] flex-1 flex-col gap-2 px-2 pb-2">
        {leads.map((l) => (
          <DraggableLead key={l.id} lead={l} now={now} onOpen={onOpen} />
        ))}
        {leads.length === 0 && (
          <div className={cn("flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground", isOver && "border-primary/50 text-primary")}>
            Trascina qui un lead
          </div>
        )}
      </div>
    </section>
  );
}

function DraggableLead({ lead, now, onOpen }: { lead: Lead; now: number; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead.id)}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
    >
      <LeadCard lead={lead} now={now} />
    </div>
  );
}

function LeadCard({ lead, now, overlay = false }: { lead: Lead; now: number; overlay?: boolean }) {
  const due = lead.nextActionAt && OPEN.has(lead.status) ? dueText(lead.nextActionAt, now) : null;
  return (
    <article
      className={cn(
        "cursor-grab rounded-lg border bg-card p-3 text-left shadow-card transition-shadow hover:border-input hover:shadow-lifted",
        overlay && "rotate-[1.5deg] cursor-grabbing shadow-lifted ring-2 ring-primary/30"
      )}
    >
      <p className="truncate text-sm font-semibold">{lead.name}</p>
      {(lead.company || lead.service) && (
        <p className="truncate text-xs text-muted-foreground">{[lead.company, lead.service].filter(Boolean).join(" · ")}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {lead.status === "nuovo" && (
          <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-1.5 font-semibold ring-1 ring-inset tabular-nums", waitTone(now - Date.parse(lead.createdAt)))}>
            <Timer className="size-3" />
            {shortDuration(now - Date.parse(lead.createdAt))}
          </span>
        )}
        {due && (
          <span className={cn("inline-flex h-5 items-center rounded-full px-1.5 font-medium ring-1 ring-inset", due.overdue ? "bg-rose-500/12 text-rose-700 ring-rose-500/25 dark:text-rose-300" : "bg-muted text-muted-foreground ring-border")}>
            {due.text}
          </span>
        )}
        {lead.status === "perso" && lead.lostReason && <span className="text-muted-foreground">{lead.lostReason}</span>}
        {lead.value ? <span className="ml-auto font-semibold tabular-nums">{formatCurrencyShort(lead.value)}</span> : null}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Full list
// ---------------------------------------------------------------------------

type ListFilter = "" | "aperti" | "vinto" | "perso";
const LIST_OPTS: Array<{ value: ListFilter; label: string }> = [
  { value: "", label: "Tutti" },
  { value: "aperti", label: "Aperti" },
  { value: "vinto", label: "Vinti" },
  { value: "perso", label: "Persi" },
];

const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

function LeadList({ leads, now }: { leads: Lead[]; now: number }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListFilter>("");
  const q = search.trim().toLowerCase();
  const rows = leads.filter((l) => {
    if (filter === "aperti" && !OPEN.has(l.status)) return false;
    if ((filter === "vinto" || filter === "perso") && l.status !== filter) return false;
    if (q && ![l.name, l.company, l.service, l.phone, l.email, l.campaign].some((v) => v?.toLowerCase().includes(q))) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Cerca per nome, azienda, telefono, campagna…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg border bg-card pl-9 pr-3 text-sm shadow-card outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
          />
        </div>
        <Segmented label="Stato" options={LIST_OPTS} value={filter} onChange={setFilter} />
        {(q || filter) && (
          <button type="button" onClick={() => { setSearch(""); setFilter(""); }} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-3.5" />
            Azzera
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{rows.length} lead</span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Nessun lead con questi filtri.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>Lead</span>
            <span>Interesse</span>
            <span className="w-32">Stato</span>
            <span>Arrivato</span>
            <span>Ultimo contatto</span>
          </div>
          <ul className="divide-y">
            {rows.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/leads/${l.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{l.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{l.company || l.phone || l.email}</span>
                  </span>
                  <span className="hidden truncate text-sm text-muted-foreground md:block">{l.service || "—"}</span>
                  <span className="md:w-32">
                    <LeadStatusPill status={l.status} />
                  </span>
                  <span className="col-span-2 text-xs text-muted-foreground md:col-span-1 md:text-sm">
                    <span className="md:hidden">Arrivato </span>
                    {dateFmt.format(Date.parse(l.createdAt))}
                    {l.campaign && <span className="block truncate text-[11px] text-muted-foreground/80">{l.campaign}</span>}
                  </span>
                  <span className="hidden text-sm text-muted-foreground md:block">
                    {l.lastContactAt ? `${shortDuration(now - Date.parse(l.lastContactAt))} fa` : "Mai"}
                    {l.callAttempts > 0 && <span className="block text-[11px]">{l.callAttempts} tentativi</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
