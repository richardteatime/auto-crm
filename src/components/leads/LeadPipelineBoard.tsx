"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, Inbox, Mail, Phone, Building2, GripVertical } from "lucide-react";
import { formatDate } from "@/lib/constants";
import {
  LEAD_PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  type Lead,
  type LeadPipelineStage,
} from "@/lib/leads/types";
import { CategoryBadge, ScoreBadge, StatusBadge } from "./lead-badges";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LeadPipelineBoardProps {
  leads: Lead[];
}

/* ------------------------------------------------------------------ */
/*  Pure card UI (no DnD logic)                                        */
/* ------------------------------------------------------------------ */
function LeadCard({
  lead,
  onClick,
  className,
  style,
  dragHandleProps,
  isOverlay,
}: {
  lead: Lead;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  isOverlay?: boolean;
}) {
  return (
    <div
      style={style}
      className={cn(
        "w-full text-left rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer group",
        isOverlay && "shadow-xl rotate-2 cursor-grabbing ring-2 ring-primary/30",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="mt-0.5 text-muted-foreground cursor-grab p-1 -ml-1"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-sm font-medium truncate">
              {lead.fullName}
            </span>
            <ScoreBadge score={lead.leadScore} />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            {lead.email && (
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 shrink-0" />
                <span>{lead.phone}</span>
              </div>
            )}
            {(lead.company || lead.businessName) && (
              <div className="flex items-center gap-1.5 truncate">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {lead.company ?? lead.businessName}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <CategoryBadge category={lead.category} />
            <StatusBadge status={lead.status} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Agg. {formatDate(lead.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sortable wrapper                                                    */
/* ------------------------------------------------------------------ */
function SortableLeadCard({
  lead,
  onClick,
}: {
  lead: Lead;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { lead } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <LeadCard lead={lead} onClick={onClick} dragHandleProps={listeners} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Droppable column                                                    */
/* ------------------------------------------------------------------ */
function DroppableStageColumn({
  stage,
  children,
  count,
}: {
  stage: LeadPipelineStage;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage } });
  const color = STAGE_COLORS[stage];

  return (
    <div
      ref={setNodeRef}
      id={stage}
      data-stage={stage}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 bg-card/50 min-h-[180px] transition-colors",
        isOver && "ring-2 ring-primary/40 bg-primary/[0.03]",
      )}
    >
      <div className="flex items-center justify-between border-b pb-2">
        <span className="text-sm font-semibold" style={{ color }}>
          {STAGE_LABELS[stage]}
        </span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Board                                                               */
/* ------------------------------------------------------------------ */
export function LeadPipelineBoard({ leads }: LeadPipelineBoardProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Lead[]>(leads);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setItems(leads);
  }, [leads]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((l) =>
      [l.fullName, l.email, l.phone, l.company, l.businessName]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [items, search]);

  const byStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const stage of LEAD_PIPELINE_STAGES) map[stage] = [];
    for (const l of filtered) (map[l.pipelineStage] ??= []).push(l);
    return map;
  }, [filtered]);

  const activeLead = useMemo(
    () => (activeId ? items.find((l) => l.id === activeId) ?? null : null),
    [activeId, items],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 12 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const lead = items.find((l) => l.id === activeId);
    if (!lead) return;

    let targetStage: string | null = null;

    if (
      LEAD_PIPELINE_STAGES.includes(
        overId as (typeof LEAD_PIPELINE_STAGES)[number],
      )
    ) {
      targetStage = overId;
    } else {
      const overLead = items.find((l) => l.id === overId);
      if (overLead) {
        targetStage = overLead.pipelineStage;
      }
    }

    if (!targetStage || lead.pipelineStage === targetStage) return;

    // Optimistic update
    setItems((prev) =>
      prev.map((l) =>
        l.id === activeId
          ? { ...l, pipelineStage: targetStage as Lead["pipelineStage"] }
          : l,
      ),
    );

    try {
      const res = await fetch(`/api/leads/${activeId}/move-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage: targetStage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Spostamento fallito");
        setItems((prev) =>
          prev.map((l) =>
            l.id === activeId
              ? { ...l, pipelineStage: lead.pipelineStage }
              : l,
          ),
        );
      }
    } catch {
      toast.error("Errore di rete");
      setItems((prev) =>
        prev.map((l) =>
          l.id === activeId
            ? { ...l, pipelineStage: lead.pipelineStage }
            : l,
        ),
      );
    }
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nessun lead"
        description="Non ci sono ancora lead. Invia un'email a POST /api/leads/email-inbound per crearne uno."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per nome, email, telefono, azienda..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {LEAD_PIPELINE_STAGES.map((stage) => {
            const stageLeads = byStage[stage] ?? [];
            return (
              <DroppableStageColumn
                key={stage}
                stage={stage}
                count={stageLeads.length}
              >
                <SortableContext
                  items={stageLeads.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {stageLeads.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-4 text-center">
                        Trascina qui
                      </p>
                    ) : (
                      stageLeads.map((lead) => (
                        <SortableLeadCard
                          key={lead.id}
                          lead={lead}
                          onClick={() => router.push(`/leads/${lead.id}`)}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DroppableStageColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeLead ? (
            <LeadCard lead={activeLead} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
