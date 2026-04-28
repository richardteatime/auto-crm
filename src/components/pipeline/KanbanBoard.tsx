"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { Input } from "@/components/ui/input";
import { KanbanColumn } from "./KanbanColumn";
import { DealCard } from "./DealCard";
import { toast } from "sonner";
import { Search, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineColumn } from "@/types";

const TEMP_OPTS = [
  { value: "", label: "Tutti" },
  { value: "hot", label: "Caldo" },
  { value: "warm", label: "Tiepido" },
  { value: "cold", label: "Freddo" },
];

const TIPO_OPTS = [
  { value: "", label: "Tutti" },
  { value: "one_time", label: "Una Tantum" },
  { value: "recurring", label: "Ricorrenti" },
];

interface KanbanBoardProps {
  initialColumns: PipelineColumn[];
}

export function KanbanBoard({ initialColumns }: KanbanBoardProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columnsSnapshot = useRef<PipelineColumn[]>(initialColumns);

  // Filters
  const [search, setSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState("");
  const [filterTipo, setFilterTipo] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const isFiltered = !!(search || filterTemp || filterTipo);

  const filteredColumns = useMemo(() => {
    if (!isFiltered) return columns;
    return columns.map((col) => ({
      ...col,
      deals: col.deals.filter((d) => {
        if (search) {
          const q = search.toLowerCase();
          const hit = d.title.toLowerCase().includes(q) ||
            (d.contactName ?? "").toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (filterTemp && d.contactTemperature !== filterTemp) return false;
        const rec = (d as { isRecurring?: boolean }).isRecurring;
        if (filterTipo === "one_time" && rec) return false;
        if (filterTipo === "recurring" && !rec) return false;
        return true;
      }),
    }));
  }, [columns, search, filterTemp, filterTipo, isFiltered]);

  const activeDeal = activeId
    ? columns.flatMap((col) => col.deals).find((d) => d.id === activeId)
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    columnsSnapshot.current = columns;
  }, [columns]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const activeColumn = columns.find((col) => col.deals.some((d) => d.id === activeId));
    const overColumn =
      columns.find((col) => col.id === overId) ||
      columns.find((col) => col.deals.some((d) => d.id === overId));
    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return;
    setColumns((prev) => {
      const activeDeal = activeColumn.deals.find((d) => d.id === activeId);
      if (!activeDeal) return prev;
      return prev.map((col) => {
        if (col.id === activeColumn.id) return { ...col, deals: col.deals.filter((d) => d.id !== activeId) };
        if (col.id === overColumn.id) return { ...col, deals: [...col.deals, { ...activeDeal, stageId: col.id }] };
        return col;
      });
    });
  }, [columns]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const activeId = active.id as string;
    const overColumn =
      columns.find((col) => col.id === over.id) ||
      columns.find((col) => col.deals.some((d) => d.id === over.id));
    if (!overColumn) return;
    try {
      const res = await fetch("/api/pipeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: activeId, stageId: overColumn.id }),
      });
      if (!res.ok) throw new Error("API error");
    } catch {
      setColumns(columnsSnapshot.current);
      toast.error("Errore durante lo spostamento della trattativa. Modifica annullata.");
    }
  }, [columns]);

  const totalDeals = columns.reduce((s, c) => s + c.deals.length, 0);
  const filteredTotal = filteredColumns.reduce((s, c) => s + c.deals.length, 0);

  return (
    <div className="space-y-4">
      {/* Pipeline filter bar */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca trattativa o contatto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          {isFiltered && (
            <button
              onClick={() => { setSearch(""); setFilterTemp(""); setFilterTipo(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2"
            >
              <X className="h-3.5 w-3.5" />
              Azzera
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Temperatura:</span>
            {TEMP_OPTS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterTemp(value)}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                  filterTemp === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Contratto:</span>
            {TIPO_OPTS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterTipo(value)}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                  filterTipo === value
                    ? value === "recurring" ? "bg-blue-600 text-white border-blue-600" : "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {value === "recurring" && <RefreshCw className="inline h-3 w-3 mr-0.5" />}
                {label}
              </button>
            ))}
          </div>

          {isFiltered && (
            <span className="text-xs text-muted-foreground">
              {filteredTotal} di {totalDeals} trattative
            </span>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {filteredColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              name={column.name}
              color={column.color}
              isWon={column.isWon}
              deals={column.deals.map((d) => ({
                id: d.id,
                title: d.title,
                value: d.value,
                contactName: d.contactName || (d.contact?.name ?? null),
                contactTemperature: d.contactTemperature || (d.contact?.temperature ?? null),
                probability: d.probability,
                isRecurring: (d as { isRecurring?: boolean }).isRecurring,
                recurringMonths: (d as { recurringMonths?: number | null }).recurringMonths,
                isPaid: (d as { isPaid?: boolean }).isPaid,
              }))}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <DealCard
              id={activeDeal.id}
              title={activeDeal.title}
              value={activeDeal.value}
              contactName={activeDeal.contactName || (activeDeal.contact?.name ?? null)}
              contactTemperature={activeDeal.contactTemperature || (activeDeal.contact?.temperature ?? null)}
              probability={activeDeal.probability}
              isRecurring={(activeDeal as { isRecurring?: boolean }).isRecurring}
              recurringMonths={(activeDeal as { recurringMonths?: number | null }).recurringMonths}
              isPaid={(activeDeal as { isPaid?: boolean }).isPaid}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
