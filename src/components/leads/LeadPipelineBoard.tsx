"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
} from "@/lib/leads/types";
import { CategoryBadge, ScoreBadge, StatusBadge } from "./lead-badges";
import { toast } from "sonner";

interface LeadPipelineBoardProps {
  leads: Lead[];
}

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
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="w-full text-left rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer group">
        <div className="flex items-start gap-2">
          <div {...listeners} className="mt-0.5 text-muted-foreground cursor-grab p-1 -ml-1">
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0" onClick={onClick}>
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
    </div>
  );
}

export function LeadPipelineBoard({ leads }: LeadPipelineBoardProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Lead[]>(leads);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 12 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const lead = items.find((l) => l.id === activeId);
    if (!lead) return;

    let targetStage: string | null = null;

    if (LEAD_PIPELINE_STAGES.includes(overId as typeof LEAD_PIPELINE_STAGES[number])) {
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
        // Revert
        setItems((prev) =>
          prev.map((l) =>
            l.id === activeId ? { ...l, pipelineStage: lead.pipelineStage } : l,
          ),
        );
      }
    } catch {
      toast.error("Errore di rete");
      setItems((prev) =>
        prev.map((l) =>
          l.id === activeId ? { ...l, pipelineStage: lead.pipelineStage } : l,
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

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {LEAD_PIPELINE_STAGES.map((stage) => {
            const stageLeads = byStage[stage] ?? [];
            const color = STAGE_COLORS[stage];
            return (
              <div
                key={stage}
                id={stage}
                className="flex flex-col gap-3 rounded-lg border p-3 bg-card/50"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm font-semibold" style={{ color }}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stageLeads.length}
                  </span>
                </div>
                <SortableContext
                  items={stageLeads.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 min-h-[80px]">
                    {stageLeads.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Nessun lead
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
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
