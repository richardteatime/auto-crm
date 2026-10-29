"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Trophy, XCircle } from "lucide-react";
import { DealCard, type DealCardData } from "./DealCard";
import { formatCurrencyShort } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: string;
  name: string;
  color: string;
  isWon?: boolean;
  isLost?: boolean;
  deals: DealCardData[];
  nowMs: number;
  onOpen: (id: string) => void;
}

export function KanbanColumn({ id, name, color, isWon, isLost, deals, nowMs, onOpen }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const total = deals.reduce((sum, d) => sum + d.value, 0);
  const weighted = deals.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${name}: ${deals.length} trattative`}
      className={cn(
        "flex w-[min(86vw,292px)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-muted/45 transition-[background-color,border-color,box-shadow] dark:bg-muted/30",
        isOver && "border-primary/45 bg-primary/[0.05] ring-4 ring-primary/10"
      )}
    >
      <div className="h-[3px]" style={{ backgroundColor: color }} />
      <header className="flex items-center gap-2 px-3 pb-1 pt-2.5">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <h2 className="truncate text-[13px] font-semibold">{name}</h2>
        <span className="rounded-full bg-background px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-muted-foreground ring-1 ring-border">
          {deals.length}
        </span>
        {isWon && <Trophy className="ml-auto size-3.5 text-emerald-500" aria-hidden="true" />}
        {isLost && <XCircle className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />}
      </header>
      <p className="px-3 pb-2.5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{formatCurrencyShort(total)}</span>
        {!isWon && !isLost && total > 0 && (
          <span className="tabular-nums"> · {formatCurrencyShort(Math.round(weighted))} ponderato</span>
        )}
      </p>

      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[140px] flex-1 flex-col gap-2 px-2 pb-2">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} isWon={isWon} isLost={isLost} nowMs={nowMs} onOpen={onOpen} />
          ))}
          {deals.length === 0 && (
            <div
              className={cn(
                "flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground transition-colors",
                isOver && "border-primary/50 text-primary"
              )}
            >
              {isWon ? "Trascina qui le trattative vinte" : "Trascina qui una trattativa"}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
