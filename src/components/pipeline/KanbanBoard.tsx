"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Search, X, RefreshCw, Trophy } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import { DealCard, TEMPERATURE_DOT, type DealCardData } from "./DealCard";
import { Segmented } from "@/components/shared/Segmented";
import { burstConfetti } from "@/lib/confetti";
import { formatCurrencyShort } from "@/lib/constants";
import { toMs } from "@/lib/utils";
import type { BillingType, DealWithContact, PipelineColumn } from "@/types";

type TempFilter = "" | "hot" | "warm" | "cold";
type BillingFilter = "" | BillingType;

const TEMP_OPTS: Array<{ value: TempFilter; label: string; dot?: string }> = [
  { value: "", label: "Tutti" },
  { value: "hot", label: "Caldi", dot: TEMPERATURE_DOT.hot.color },
  { value: "warm", label: "Tiepidi", dot: TEMPERATURE_DOT.warm.color },
  { value: "cold", label: "Freddi", dot: TEMPERATURE_DOT.cold.color },
];

const BILLING_OPTS: Array<{ value: BillingFilter; label: React.ReactNode }> = [
  { value: "", label: "Tutti i contratti" },
  { value: "una_tantum", label: "Una tantum" },
  {
    value: "mensile",
    label: (
      <>
        <RefreshCw className="size-3" />
        Mensili
      </>
    ),
  },
  {
    value: "annuale",
    label: (
      <>
        <RefreshCw className="size-3" />
        Annuali
      </>
    ),
  },
];

// The column (or card) under the pointer wins; "closest corners" picked short columns by mistake
const kanbanCollision: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : rectIntersection(args);
};

function toCard(d: DealWithContact): DealCardData {
  return {
    id: d.id,
    title: d.title,
    value: d.value ?? 0,
    contactName: d.contactName || (d.contact?.name ?? null),
    contactTemperature: d.contactTemperature || (d.contact?.temperature ?? null),
    probability: d.probability ?? 0,
    billingType: d.billingType,
    recurringMonths: d.recurringMonths,
    isPaid: d.isPaid,
    expectedCloseMs: toMs(d.expectedClose),
    updatedMs: toMs(d.updatedAt),
  };
}

interface KanbanBoardProps {
  initialColumns: PipelineColumn[];
  nowMs: number;
}

export function KanbanBoard({ initialColumns, nowMs }: KanbanBoardProps) {
  const router = useRouter();
  const [columns, setColumns] = useState(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columnsSnapshot = useRef<PipelineColumn[]>(initialColumns);
  const sourceColumnId = useRef<string | null>(null);
  const lastDragEnd = useRef(0);

  const [search, setSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState<TempFilter>("");
  const [filterBilling, setFilterBilling] = useState<BillingFilter>("");

  // Mouse drags after a small move; on touch a short press starts the drag so the board still scrolls
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    // Space picks a card up and drops it; Enter stays free to open the deal
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    })
  );

  const isFiltered = !!(search || filterTemp || filterBilling);

  const filteredColumns = useMemo(() => {
    if (!isFiltered) return columns;
    const q = search.trim().toLowerCase();
    return columns.map((col) => ({
      ...col,
      deals: col.deals.filter((d) => {
        if (q) {
          const hit =
            d.title.toLowerCase().includes(q) ||
            (d.contactName ?? d.contact?.name ?? "").toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (filterTemp && (d.contactTemperature || d.contact?.temperature) !== filterTemp) return false;
        if (filterBilling && d.billingType !== filterBilling) return false;
        return true;
      }),
    }));
  }, [columns, search, filterTemp, filterBilling, isFiltered]);

  const activeDeal = activeId ? columns.flatMap((col) => col.deals).find((d) => d.id === activeId) : null;

  const openDeal = useCallback(
    (id: string) => {
      // A drop also fires a click on the card: ignore it
      if (Date.now() - lastDragEnd.current < 300) return;
      router.push(`/deals/${id}`);
    },
    [router]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      setActiveId(id);
      columnsSnapshot.current = columns;
      sourceColumnId.current = columns.find((col) => col.deals.some((d) => d.id === id))?.id ?? null;
    },
    [columns]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;
      const dragId = active.id as string;
      const overId = over.id as string;
      const activeColumn = columns.find((col) => col.deals.some((d) => d.id === dragId));
      const overColumn =
        columns.find((col) => col.id === overId) || columns.find((col) => col.deals.some((d) => d.id === overId));
      if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return;
      setColumns((prev) => {
        const moving = activeColumn.deals.find((d) => d.id === dragId);
        if (!moving) return prev;
        return prev.map((col) => {
          if (col.id === activeColumn.id) return { ...col, deals: col.deals.filter((d) => d.id !== dragId) };
          if (col.id === overColumn.id) return { ...col, deals: [...col.deals, { ...moving, stageId: col.id }] };
          return col;
        });
      });
    },
    [columns]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      lastDragEnd.current = Date.now();
      if (!over) {
        setColumns(columnsSnapshot.current);
        return;
      }
      const dragId = active.id as string;
      const overColumn =
        columns.find((col) => col.id === over.id) || columns.find((col) => col.deals.some((d) => d.id === over.id));
      if (!overColumn || overColumn.id === sourceColumnId.current) return;

      const deal = columnsSnapshot.current.flatMap((c) => c.deals).find((d) => d.id === dragId);
      const rect = active.rect.current.translated;

      try {
        const res = await fetch("/api/pipeline", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId: dragId, stageId: overColumn.id }),
        });
        if (!res.ok) throw new Error("API error");

        if (overColumn.isWon) {
          burstConfetti(rect ? rect.left + rect.width / 2 : undefined, rect ? rect.top + rect.height / 2 : undefined);
          toast.success("Trattativa vinta!", {
            description: deal ? `${deal.title} · ${formatCurrencyShort(deal.value ?? 0)}` : undefined,
            icon: <Trophy className="size-4 text-emerald-500" />,
          });
        } else {
          toast(`Spostata in «${overColumn.name}»`, { description: deal?.title });
        }
      } catch {
        setColumns(columnsSnapshot.current);
        toast.error("Non sono riuscito a spostare la trattativa. Modifica annullata.");
      }
    },
    [columns]
  );

  const totalDeals = columns.reduce((s, c) => s + c.deals.length, 0);
  const filteredTotal = filteredColumns.reduce((s, c) => s + c.deals.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Cerca trattativa o contatto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg border bg-card pl-9 pr-3 text-sm shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
          />
        </div>
        <Segmented label="Temperatura" options={TEMP_OPTS} value={filterTemp} onChange={setFilterTemp} />
        <Segmented label="Tipo di contratto" options={BILLING_OPTS} value={filterBilling} onChange={setFilterBilling} className="hidden lg:inline-flex" />
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilterTemp("");
              setFilterBilling("");
            }}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
            Azzera
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {isFiltered ? `${filteredTotal} di ${totalDeals} trattative` : `${totalDeals} trattative`}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setColumns(columnsSnapshot.current);
        }}
      >
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin md:-mx-8 md:snap-none md:px-8">
          {filteredColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              name={column.name}
              color={column.color}
              isWon={column.isWon}
              isLost={column.isLost}
              deals={column.deals.map(toCard)}
              nowMs={nowMs}
              onOpen={openDeal}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {activeDeal ? <DealCard deal={toCard(activeDeal)} nowMs={nowMs} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
