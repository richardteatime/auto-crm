"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "./RunStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, Bot, ArrowRight, X, SlidersHorizontal } from "lucide-react";
import { formatDate } from "@/lib/constants";
import type { OrchestratorRun, RunStatus } from "@/lib/orchestrator/types";

const STATUS_OPTIONS: { value: RunStatus | ""; label: string }[] = [
  { value: "", label: "Tutti" },
  { value: "running", label: "In esecuzione" },
  { value: "pending_dispatch", label: "In coda" },
  { value: "dispatched", label: "Dispacciato" },
  { value: "waiting_for_data", label: "In attesa dati" },
  { value: "completed", label: "Completato" },
  { value: "failed", label: "Fallito" },
];

interface RunsTableProps {
  runs: OrchestratorRun[];
}

export function RunsTable({ runs }: RunsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<RunStatus | "">("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        const hit =
          r.commandText.toLowerCase().includes(q) ||
          r.intent.toLowerCase().includes(q) ||
          r.senderPhone?.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filterStatus && r.status !== filterStatus) return false;
      return true;
    });
  }, [runs, search, filterStatus]);

  const isFiltered = search || filterStatus;

  const reset = () => {
    setSearch("");
    setFilterStatus("");
  };

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="Nessuna run"
        description="L'orchestrator non ha ancora processato comandi. Invia un messaggio da Chatwoot per iniziare."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per comando, intento, telefono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters((v) => !v)}
          className={showFilters ? "bg-accent" : ""}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={filterStatus === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}

      {isFiltered && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{filtered.length} risultati</span>
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Stato</TableHead>
              <TableHead>Comando</TableHead>
              <TableHead>Intento</TableHead>
              <TableHead>Sorgente</TableHead>
              <TableHead className="w-[140px]">Data</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((run) => (
              <TableRow
                key={run.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/orchestrator/${run.id}`)}
              >
                <TableCell>
                  <RunStatusBadge status={run.status} size="sm" />
                </TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {run.commandText}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {run.intent}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {run.source}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {formatDate(run.createdAt)}
                </TableCell>
                <TableCell>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
