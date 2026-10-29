import type { Metadata } from "next";
import { getDeal, getStages, listActivities, getContact } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Gauge, RefreshCw, Scale, Wallet, StickyNote, Euro } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { formatDayMonth, romeDayDiff } from "@/lib/dates";
import { toMs, cn } from "@/lib/utils";
import { DealEditButton } from "@/components/deals/DealEditButton";
import { DealPaymentToggle } from "@/components/deals/DealPaymentToggle";
import { DealActivities } from "@/components/deals/DealActivities";
import { StageStepper } from "@/components/deals/StageStepper";
import { QuoteList } from "@/components/quotes/QuoteList";
import { ContactAvatar } from "@/components/shared/ContactAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Temperature } from "@/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const deal = await getDeal(id);
  return { title: deal?.title ?? "Trattativa" };
}

const BILLING_LABEL: Record<string, string> = {
  una_tantum: "Una tantum",
  mensile: "Mensile",
  annuale: "Annuale",
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  const nowMs = now.getTime();

  const deal = await getDeal(id);
  if (!deal) notFound();

  const [stages, dealActivities, contact] = await Promise.all([
    getStages(),
    listActivities({ dealId: id }),
    deal.contactId ? getContact(deal.contactId) : Promise.resolve(null),
  ]);

  const stage = stages.find((s) => s.id === deal.stageId) ?? null;
  const value = deal.value ?? 0;
  const probability = deal.probability ?? 0;
  const closeMs = toMs(deal.expectedClose);
  const closeDiff = closeMs ? romeDayDiff(nowMs, closeMs) : null;
  const isOpen = stage ? !stage.isWon && !stage.isLost : true;
  const recurring = deal.billingType && deal.billingType !== "una_tantum";
  const contactName = contact?.name ?? deal.contactName ?? null;

  const stats = [
    {
      icon: Euro,
      label: "Valore",
      value: formatCurrency(value),
      hint: recurring ? `${BILLING_LABEL[deal.billingType]} · ${deal.recurringMonths ?? 12} mesi` : BILLING_LABEL[deal.billingType] ?? "",
    },
    {
      icon: Gauge,
      label: "Probabilità",
      value: `${probability}%`,
      hint: probability >= 70 ? "alta" : probability >= 40 ? "media" : "bassa",
      bar: probability,
    },
    {
      icon: Scale,
      label: "Valore ponderato",
      value: formatCurrency(Math.round((value * probability) / 100)),
      hint: "valore × probabilità",
    },
    {
      icon: CalendarClock,
      label: "Chiusura prevista",
      value: closeMs ? formatDayMonth(closeMs) : "—",
      hint:
        closeDiff === null
          ? "da definire"
          : !isOpen
            ? ""
            : closeDiff < 0
              ? `in ritardo di ${-closeDiff} giorni`
              : closeDiff === 0
                ? "oggi"
                : `tra ${closeDiff} giorni`,
      danger: isOpen && closeDiff !== null && closeDiff < 0,
    },
  ];

  return (
    <div className="space-y-5">
      <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        Pipeline
      </Link>

      <section className="relative overflow-hidden rounded-2xl border bg-card shadow-card">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-brand-radial opacity-70" />
        <div className="relative space-y-5 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {stage && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ backgroundColor: `${stage.color}1f`, color: stage.color }}
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                  </span>
                )}
                {recurring && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <RefreshCw className="size-3" />
                    Ricorrente
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-[28px]">{deal.title}</h1>
              {contactName && (
                <Link
                  href={contact ? `/contacts/${contact.id}` : "/contacts"}
                  className="mt-2 inline-flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3 text-sm transition-colors hover:border-input hover:bg-muted/60"
                >
                  <ContactAvatar name={contactName} size="sm" />
                  <span className="font-medium">{contactName}</span>
                  {contact?.company && <span className="text-muted-foreground">· {contact.company}</span>}
                  {contact?.temperature && <StatusBadge temperature={contact.temperature as Temperature} size="sm" />}
                </Link>
              )}
            </div>
            <DealEditButton
              deal={{
                id: deal.id,
                title: deal.title,
                value: deal.value,
                contactId: deal.contactId,
                stageId: deal.stageId,
                probability: deal.probability,
                expectedClose: deal.expectedClose
                  ? deal.expectedClose instanceof Date
                    ? deal.expectedClose.getTime()
                    : deal.expectedClose
                  : null,
                notes: deal.notes,
                attachments: deal.attachments,
                billingType: deal.billingType,
                recurringMonths: deal.recurringMonths,
                isPaid: deal.isPaid,
              }}
            />
          </div>

          {stages.length > 0 && <StageStepper dealId={deal.id} stages={stages} currentId={deal.stageId} />}
        </div>

        <dl className="relative grid grid-cols-2 border-t lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                "px-5 py-4 md:px-6",
                i % 2 === 1 && "border-l",
                i >= 2 && "border-t lg:border-t-0",
                i === 2 && "lg:border-l"
              )}
            >
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <s.icon className="size-3.5" />
                {s.label}
              </dt>
              <dd className={cn("mt-1 text-xl font-bold tracking-tight tabular-nums", s.danger && "text-rose-600 dark:text-rose-400")}>
                {s.value}
              </dd>
              {"bar" in s && typeof s.bar === "number" ? (
                <div className="mt-1.5 h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${s.bar}%` }} />
                </div>
              ) : (
                s.hint && <p className={cn("mt-0.5 text-xs", s.danger ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>{s.hint}</p>
              )}
            </div>
          ))}
        </dl>
      </section>

      {stage?.isWon && (
        <section className="flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 sm:flex-row sm:items-center">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <Wallet className="size-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Pagamento</p>
            <p className="text-xs text-muted-foreground">Segna l&apos;incasso: il fatturato in Finance si aggiorna da solo.</p>
          </div>
          <DealPaymentToggle dealId={deal.id} isPaid={deal.isPaid ?? false} />
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DealActivities dealId={deal.id} contactId={deal.contactId} activities={dealActivities} />
        </div>
        <section className="rounded-xl border bg-card p-4 shadow-card">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <StickyNote className="size-4 text-muted-foreground" />
            Note
          </h2>
          {deal.notes ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{deal.notes}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Nessuna nota. Aggiungile da «Modifica».</p>
          )}
        </section>
      </div>

      <QuoteList dealId={deal.id} />
    </div>
  );
}
