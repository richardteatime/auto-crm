"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, CheckCircle2, Circle, Hourglass, RefreshCw } from "lucide-react";
import { ContactAvatar } from "@/components/shared/ContactAvatar";
import { formatCurrencyShort } from "@/lib/constants";
import { formatDayMonth, romeDayDiff } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { BillingType } from "@/types";

export interface DealCardData {
  id: string;
  title: string;
  value: number;
  contactName: string | null;
  contactTemperature: string | null;
  probability: number;
  billingType?: BillingType;
  recurringMonths?: number | null;
  isPaid?: boolean;
  expectedCloseMs: number;
  updatedMs: number;
}

export const TEMPERATURE_DOT: Record<string, { color: string; label: string }> = {
  hot: { color: "#f43f5e", label: "Caldo" },
  warm: { color: "#f59e0b", label: "Tiepido" },
  cold: { color: "#38bdf8", label: "Freddo" },
};

const STALE_DAYS = 14;

function probabilityColor(p: number) {
  if (p >= 70) return "#10b981";
  if (p >= 40) return "#f59e0b";
  return "#94a3b8";
}

interface DealCardProps {
  deal: DealCardData;
  isWon?: boolean;
  isLost?: boolean;
  nowMs: number;
}

const CARD_CLASS = "group relative select-none rounded-lg border bg-card p-3 text-left shadow-card";

export function DealCard({ deal, isWon, isLost, nowMs, onOpen }: DealCardProps & { onOpen?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(deal.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen?.(deal.id);
      }}
      aria-label={`${deal.title}, ${formatCurrencyShort(deal.value)}`}
      className={cn(
        CARD_CLASS,
        "cursor-grab touch-manipulation outline-none transition-[box-shadow,border-color,opacity] hover:border-input hover:shadow-lifted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
        isDragging && "opacity-35",
        isLost && "opacity-70"
      )}
    >
      <DealCardBody deal={deal} isWon={isWon} isLost={isLost} nowMs={nowMs} />
    </div>
  );
}

/** The copy that follows the pointer. No dnd hooks here: it would re-register the dragged card's id. */
export function DealCardOverlay({ deal, nowMs }: DealCardProps) {
  return (
    <div className={cn(CARD_CLASS, "rotate-[1.5deg] scale-[1.02] cursor-grabbing border-primary/40 shadow-lifted")}>
      <DealCardBody deal={deal} nowMs={nowMs} />
    </div>
  );
}

function DealCardBody({ deal, isWon, isLost, nowMs }: DealCardProps) {
  const open = !isWon && !isLost;
  const recurring = deal.billingType && deal.billingType !== "una_tantum";
  const suffix = deal.billingType === "mensile" ? "/mese" : deal.billingType === "annuale" ? "/anno" : "";
  const temp = deal.contactTemperature ? TEMPERATURE_DOT[deal.contactTemperature] : null;
  const closeDiff = deal.expectedCloseMs ? romeDayDiff(nowMs, deal.expectedCloseMs) : null;
  const staleDays = deal.updatedMs ? Math.floor((nowMs - deal.updatedMs) / 86_400_000) : 0;

  return (
    <>
      <div className="flex items-start gap-2">
        <p className="line-clamp-2 flex-1 text-[13px] font-semibold leading-snug">{deal.title}</p>
        {recurring && (
          <span
            title={`Ricorrente, ${deal.recurringMonths ?? 12} mesi`}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
          >
            <RefreshCw className="size-2.5" />
            {deal.recurringMonths ?? 12}m
          </span>
        )}
      </div>

      <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <ContactAvatar name={deal.contactName} size="xs" />
        <span className="truncate">{deal.contactName ?? "Senza contatto"}</span>
        {temp && (
          <span className="ml-auto flex shrink-0 items-center gap-1" title={`Lead ${temp.label.toLowerCase()}`}>
            <span className="size-1.5 rounded-full" style={{ backgroundColor: temp.color }} />
            <span className="text-[11px]">{temp.label}</span>
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-[15px] font-bold leading-none tracking-tight tabular-nums">
          {formatCurrencyShort(deal.value)}
          {suffix && <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">{suffix}</span>}
        </span>
        {open && closeDiff !== null && (
          <span
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium tabular-nums",
              closeDiff < 0 ? "text-rose-600 dark:text-rose-400" : closeDiff <= 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            )}
            title="Chiusura prevista"
          >
            <CalendarClock className="size-3" />
            {formatDayMonth(deal.expectedCloseMs)}
          </span>
        )}
        {isWon && (
          <span
            className={cn(
              "flex items-center gap-1 text-[11px] font-semibold",
              deal.isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
            )}
          >
            {deal.isPaid ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
            {deal.isPaid ? "Pagato" : "Da incassare"}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, deal.probability))}%`, backgroundColor: probabilityColor(deal.probability) }}
            />
          </div>
          <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{deal.probability}%</span>
        </div>
      )}

      {open && staleDays >= STALE_DAYS && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <Hourglass className="size-3" />
          Ferma da {staleDays} giorni
        </p>
      )}
    </>
  );
}
