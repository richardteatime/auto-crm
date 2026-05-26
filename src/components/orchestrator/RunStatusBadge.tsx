"use client";

import { Badge } from "@/components/ui/badge";
import type { RunStatus } from "@/lib/orchestrator/types";

const STATUS_CONFIG: Record<RunStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "In attesa", color: "#6b7280", bg: "#f3f4f6" },
  running: { label: "In esecuzione", color: "#2563eb", bg: "#dbeafe" },
  waiting_for_data: { label: "In attesa dati", color: "#d97706", bg: "#fef3c7" },
  pending_dispatch: { label: "In coda", color: "#7c3aed", bg: "#ede9fe" },
  dispatched: { label: "Dispacciato", color: "#0891b2", bg: "#cffafe" },
  completed: { label: "Completato", color: "#059669", bg: "#d1fae5" },
  failed: { label: "Fallito", color: "#dc2626", bg: "#fee2e2" },
  cancelled: { label: "Annullato", color: "#6b7280", bg: "#f3f4f6" },
  unauthorized: { label: "Non autorizzato", color: "#991b1b", bg: "#fecaca" },
};

interface RunStatusBadgeProps {
  status: RunStatus;
  size?: "sm" | "md";
}

export function RunStatusBadge({ status, size = "md" }: RunStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <Badge
      variant="outline"
      className={size === "sm" ? "text-[10px] px-1.5 py-0" : ""}
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderColor: config.color,
      }}
    >
      {config.label}
    </Badge>
  );
}
