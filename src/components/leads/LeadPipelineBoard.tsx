"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, Inbox, Mail, Phone, Building2 } from "lucide-react";
import { formatDate } from "@/lib/constants";
import {
  LEAD_PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  type Lead,
} from "@/lib/leads/types";
import { CategoryBadge, ScoreBadge, StatusBadge } from "./lead-badges";

interface LeadPipelineBoardProps {
  leads: Lead[];
}

export function LeadPipelineBoard({ leads }: LeadPipelineBoardProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter((l) =>
      [l.fullName, l.email, l.phone, l.company, l.businessName]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [leads, search]);

  const byStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const stage of LEAD_PIPELINE_STAGES) map[stage] = [];
    for (const l of filtered) (map[l.pipelineStage] ??= []).push(l);
    return map;
  }, [filtered]);

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {LEAD_PIPELINE_STAGES.map((stage) => {
          const items = byStage[stage] ?? [];
          const color = STAGE_COLORS[stage];
          return (
            <div key={stage} className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-semibold" style={{ color }}>
                  {STAGE_LABELS[stage]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nessun lead
                  </p>
                ) : (
                  items.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="w-full text-left rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
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
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
