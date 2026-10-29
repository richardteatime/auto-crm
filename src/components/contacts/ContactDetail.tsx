"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Pencil,
  Trash2,
  Plus,
  MessageCircle,
  Copy,
  Check,
  NotebookPen,
  MoreHorizontal,
  MapPin,
  Receipt,
  Handshake,
  ListPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContactAvatar } from "@/components/shared/ContactAvatar";
import { ContactForm } from "./ContactForm";
import { ContactTimeline, type TimelineActivity } from "./ContactTimeline";
import { ActivityForm, type ActivityInitialData } from "@/components/activities/ActivityForm";
import { DealForm } from "@/components/deals/DealForm";
import { OpportunityList } from "@/components/opportunities/OpportunityList";
import { formatCurrencyShort, cleanPhoneForWhatsApp, SOURCE_LABELS } from "@/lib/constants";
import { agoLabel, formatDayMonth } from "@/lib/dates";
import { toMs, cn } from "@/lib/utils";
import type { Temperature, LeadSource } from "@/types";

interface ContactDetailClientProps {
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    vatNumber?: string | null;
    address?: string | null;
    source: string;
    temperature: string;
    notes: string | null;
    createdAt: number | Date;
  };
  deals: Array<{
    id: string;
    title: string;
    value: number;
    probability: number;
    stageName: string | null;
    stageColor: string | null;
    isWon?: boolean;
    isLost?: boolean;
    createdAt: number | Date;
  }>;
  activities: TimelineActivity[];
  nowMs: number;
}

export function ContactDetailClient({ contact, deals, activities, nowMs }: ContactDetailClientProps) {
  const router = useRouter();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityInitialData | undefined>(undefined);
  const [showDealForm, setShowDealForm] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [internalNotes, setInternalNotes] = useState(contact.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);

  const notesDirty = internalNotes !== (contact.notes || "");
  const openDeals = deals.filter((d) => !d.isWon && !d.isLost);
  const openValue = openDeals.reduce((s, d) => s + d.value, 0);
  const wonValue = deals.filter((d) => d.isWon).reduce((s, d) => s + d.value, 0);
  const lastTouch = activities.reduce((max, a) => Math.max(max, toMs(a.completedAt ?? a.createdAt)), 0);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: internalNotes }),
      });
      if (!res.ok) throw new Error();
      toast.success("Note salvate");
      router.refresh();
    } catch {
      toast.error("Errore durante il salvataggio");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success("Copiato negli appunti");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Errore durante la copia");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Eliminare ${contact.name}? Questa azione non può essere annullata.`)) return;
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore durante l'eliminazione");
      toast.success("Contatto eliminato");
      router.push("/contacts");
    } catch {
      toast.error("Errore durante l'eliminazione del contatto");
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Errore");
      toast.success("Attività completata");
      router.refresh();
    } catch {
      toast.error("Errore durante il completamento dell'attività");
    }
  };

  const stats = [
    { label: "In trattativa", value: formatCurrencyShort(openValue), hint: `${openDeals.length} aperte` },
    { label: "Vinto", value: formatCurrencyShort(wonValue), hint: wonValue > 0 ? "cliente" : "ancora nulla" },
    { label: "Interazioni", value: String(activities.length), hint: "registrate" },
    { label: "Ultimo contatto", value: lastTouch ? agoLabel(lastTouch, nowMs) : "mai", hint: "" },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Contatti
      </Link>

      {/* Profile */}
      <section className="relative overflow-hidden rounded-2xl border bg-card shadow-card">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-brand-radial opacity-70" />
        <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
          <ContactAvatar name={contact.name} size="xl" className="ring-4 ring-card" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-extrabold tracking-tight md:text-[28px]">{contact.name}</h1>
              <StatusBadge temperature={contact.temperature as Temperature} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {contact.company && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="size-3.5" />
                  {contact.company}
                </span>
              )}
              <span>
                {contact.company ? "· " : ""}
                {SOURCE_LABELS[contact.source as LeadSource] || contact.source}
              </span>
              <span>· aggiunto il {formatDayMonth(toMs(contact.createdAt))}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {contact.phone && (
              <>
                <Button variant="outline" size="sm" nativeButton={false} render={<a href={`tel:${contact.phone}`} />} className="gap-1.5">
                  <Phone className="size-3.5" />
                  Chiama
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={`https://wa.me/${cleanPhoneForWhatsApp(contact.phone)}`} target="_blank" rel="noopener noreferrer" />}
                  className="gap-1.5"
                >
                  <MessageCircle className="size-3.5 text-emerald-600" />
                  WhatsApp
                </Button>
              </>
            )}
            {contact.email && (
              <Button variant="outline" size="sm" nativeButton={false} render={<a href={`mailto:${contact.email}`} />} className="gap-1.5">
                <Mail className="size-3.5" />
                Email
              </Button>
            )}
            <Button size="sm" onClick={() => setShowActivityForm(true)} className="gap-1.5">
              <ListPlus className="size-3.5" />
              Attività
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Altre azioni" />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setShowDealForm(true)}>
                  <Handshake />
                  Nuova trattativa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowEditForm(true)}>
                  <Pencil />
                  Modifica contatto
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                  <Trash2 />
                  Elimina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <dl className="relative grid grid-cols-2 border-t md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={cn("px-5 py-3.5 md:px-6", i % 2 === 1 && "border-l", i >= 2 && "border-t md:border-t-0", i >= 2 && "md:border-l")}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</dt>
              <dd className="mt-0.5 text-lg font-bold tracking-tight tabular-nums">
                {s.value}
                {s.hint && <span className="ml-1.5 text-xs font-medium text-muted-foreground">{s.hint}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <ContactTimeline
            activities={activities}
            nowMs={nowMs}
            onAdd={() => setShowActivityForm(true)}
            onComplete={handleCompleteActivity}
            onEdit={(a) =>
              setEditingActivity({
                id: a.id,
                type: a.type,
                description: a.description,
                contactId: contact.id,
                dealId: a.dealId ?? null,
                startAt: a.startAt ? String(a.startAt) : null,
                endAt: a.endAt ? String(a.endAt) : null,
                notes: a.notes ?? null,
                attachments: a.attachments ?? null,
              })
            }
          />
          <OpportunityList contactId={contact.id} />
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border bg-card p-4 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">Recapiti</h2>
            <dl className="space-y-2.5 text-sm">
              <InfoRow icon={Mail} label="Email" value={contact.email} href={contact.email ? `mailto:${contact.email}` : undefined} onCopy={() => contact.email && handleCopy(contact.email, "email")} copied={copiedField === "email"} />
              <InfoRow icon={Phone} label="Telefono" value={contact.phone} href={contact.phone ? `tel:${contact.phone}` : undefined} onCopy={() => contact.phone && handleCopy(contact.phone, "phone")} copied={copiedField === "phone"} />
              <InfoRow icon={Receipt} label="P. IVA" value={contact.vatNumber ?? null} onCopy={() => contact.vatNumber && handleCopy(contact.vatNumber, "vat")} copied={copiedField === "vat"} />
              <InfoRow icon={MapPin} label="Indirizzo" value={contact.address ?? null} href={contact.address ? `https://maps.google.com/?q=${encodeURIComponent(contact.address)}` : undefined} />
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center">
              <h2 className="text-sm font-semibold">Trattative</h2>
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{deals.length}</span>
              <Button variant="ghost" size="xs" onClick={() => setShowDealForm(true)} className="ml-auto gap-1">
                <Plus className="size-3" />
                Nuova
              </Button>
            </div>
            {deals.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessuna trattativa con questo contatto.</p>
            ) : (
              <ul className="-mx-1 space-y-0.5">
                {deals.map((deal) => (
                  <li key={deal.id}>
                    <Link href={`/deals/${deal.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-2 transition-colors hover:bg-muted/60">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: deal.stageColor ?? "#94a3b8" }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{deal.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{deal.stageName ?? "—"}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrencyShort(deal.value)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-card">
            <div className="mb-2 flex items-center gap-2">
              <NotebookPen className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Note</h2>
              {notesDirty && <span className="text-[11px] text-amber-600 dark:text-amber-400">modifiche non salvate</span>}
            </div>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Come stanno andando le cose con questo contatto…"
              className="min-h-[140px] w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
            />
            <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes || !notesDirty} className="mt-2 w-full">
              {savingNotes ? "Salvataggio…" : "Salva note"}
            </Button>
          </section>
        </aside>
      </div>

      <ContactForm
        open={showEditForm}
        onClose={() => {
          setShowEditForm(false);
          router.refresh();
        }}
        initialData={{
          id: contact.id,
          name: contact.name,
          email: contact.email || "",
          phone: contact.phone || "",
          company: contact.company || "",
          source: contact.source,
          temperature: contact.temperature as "cold" | "warm" | "hot",
          notes: contact.notes || "",
        }}
      />

      <ActivityForm
        open={showActivityForm || !!editingActivity}
        onClose={() => {
          setShowActivityForm(false);
          setEditingActivity(undefined);
          router.refresh();
        }}
        preselectedContactId={contact.id}
        initialData={editingActivity}
      />

      <DealForm
        open={showDealForm}
        onClose={() => {
          setShowDealForm(false);
          router.refresh();
        }}
        preselectedContactId={contact.id}
      />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  onCopy,
  copied,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  href?: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="group flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd className="truncate">
          {value ? (
            href ? (
              <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="hover:text-primary hover:underline">
                {value}
              </a>
            ) : (
              value
            )
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </dd>
      </div>
      {value && onCopy && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copia ${label.toLowerCase()}`}
          className="mt-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        </button>
      )}
    </div>
  );
}
