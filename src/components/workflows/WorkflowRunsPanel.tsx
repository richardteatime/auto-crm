"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { RUN_STATUS_LABELS } from "@/lib/workflows/types";
import type { WorkflowRun, WorkflowRunLog } from "@/lib/workflows/types";

interface WorkflowRunsPanelProps {
  workflowId: string;
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  scheduled: "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300",
  completed: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300",
  failed: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300",
  cancelled: "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400",
};

const LOG_STATUS_STYLES: Record<string, string> = {
  ok: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300",
  skipped: "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400",
  failed: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300",
  pending: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
};

export function WorkflowRunsPanel({ workflowId }: WorkflowRunsPanelProps) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [logs, setLogs] = useState<Record<string, WorkflowRunLog[]>>({});
  const [loading, setLoading] = useState(false);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`);
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRun = async (runId: string) => {
    if (openRunId === runId) {
      setOpenRunId(null);
      return;
    }
    setOpenRunId(runId);
    if (!logs[runId]) {
      try {
        const res = await fetch(`/api/workflow/runs/${runId}/logs`);
        const data = await res.json();
        setLogs((prev) => ({ ...prev, [runId]: Array.isArray(data) ? data : [] }));
      } catch {
        setLogs((prev) => ({ ...prev, [runId]: [] }));
      }
    }
  };

  return (
    <div className="flex flex-col h-full border-l w-80 bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Esecuzioni</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-2">
        {runs.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-6">Nessuna esecuzione</p>
        )}
        {runs.map((run) => (
          <div key={run.id} className="rounded-md border">
            <button
              onClick={() => toggleRun(run.id)}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/50 transition-colors"
            >
              {openRunId === run.id ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES[run.status] ?? ""}`}>
                    {RUN_STATUS_LABELS[run.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </button>
            {openRunId === run.id && (
              <div className="mt-1 ml-4 mr-2 mb-2 space-y-1">
                {(logs[run.id] ?? []).map((log) => (
                  <div key={log.id} className="rounded border px-2 py-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{log.nodeType}</span>
                      <Badge className={`text-[10px] px-1 py-0 ${LOG_STATUS_STYLES[log.status] ?? ""}`}>
                        {log.status}
                      </Badge>
                    </div>
                    {log.error && (
                      <p className="text-[10px] text-red-600 mt-1 truncate">{log.error}</p>
                    )}
                  </div>
                ))}
                {(logs[run.id] ?? []).length === 0 && (
                  <p className="text-[10px] text-muted-foreground py-1">Nessun log</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
