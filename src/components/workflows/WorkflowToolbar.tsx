"use client";

import { Button } from "@/components/ui/button";
import { Save, Play, Pause, ArrowLeft } from "lucide-react";
import type { WorkflowStatus } from "@/lib/workflows/types";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

interface WorkflowToolbarProps {
  name: string;
  status: WorkflowStatus;
  onSave: () => void;
  onTest: () => void;
  onToggleStatus: () => void;
  onBack: () => void;
  saving?: boolean;
  testing?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300",
  paused: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
  archived: "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400",
};

export function WorkflowToolbar({
  name,
  status,
  onSave,
  onTest,
  onToggleStatus,
  onBack,
  saving,
  testing,
}: WorkflowToolbarProps) {
  const isActive = status === "active";

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-card">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-sm font-semibold leading-tight">{name || "Nuovo Workflow"}</h1>
          <div className="flex items-center gap-1.5">
            <span className={cn("inline-block rounded-full px-1.5 py-0 text-[10px] font-medium", STATUS_STYLES[status])}>
              {WORKFLOW_STATUS_LABELS[status]}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="cursor-pointer gap-1 text-xs" onClick={onTest} disabled={testing}>
          <Play className="h-3.5 w-3.5" />
          {testing ? "Test..." : "Test"}
        </Button>
        <Button variant="outline" size="sm" className="cursor-pointer gap-1 text-xs" onClick={onToggleStatus}>
          {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {isActive ? "Pausa" : "Attiva"}
        </Button>
        <Button size="sm" className="cursor-pointer gap-1 text-xs" onClick={onSave} disabled={saving}>
          <Save className="h-3.5 w-3.5" />
          {saving ? "Salvataggio..." : "Salva"}
        </Button>
      </div>
    </div>
  );
}
