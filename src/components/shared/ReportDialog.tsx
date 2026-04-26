"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Download, BarChart2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

export type ReportSection =
  | "contacts"
  | "deals"
  | "activities"
  | "quotes"
  | "tasks"
  | "finance";

const SECTION_LABELS: Record<ReportSection, string> = {
  contacts: "Contatti",
  deals: "Trattative",
  activities: "Attività",
  quotes: "Preventivi",
  tasks: "Task",
  finance: "Finance",
};

type QuickPeriod = "month" | "quarter" | "year" | "custom";

const QUICK_OPTS: { value: QuickPeriod; label: string }[] = [
  { value: "month", label: "Questo Mese" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Quest'Anno" },
  { value: "custom", label: "Personalizzato" },
];

function periodRange(type: QuickPeriod): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];
  if (type === "month") {
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (type === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return {
      from: iso(new Date(now.getFullYear(), q * 3, 1)),
      to: iso(new Date(now.getFullYear(), q * 3 + 3, 0)),
    };
  }
  return {
    from: iso(new Date(now.getFullYear(), 0, 1)),
    to: iso(new Date(now.getFullYear(), 11, 31)),
  };
}

interface SummaryStats {
  count?: number;
  hot?: number; warm?: number; cold?: number; avgScore?: number;
  totalValue?: number; wonCount?: number; wonValue?: number; recurring?: number;
  completed?: number; open?: number; byType?: Record<string, number>;
  byStatus?: Record<string, number>; acceptedValue?: number; winRate?: number;
  done?: number; todo?: number; overdue?: number;
  revenue?: number; mrr?: number; expenses?: number; cashFlow?: number; expenseCount?: number;
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold mt-0.5", color ?? "text-foreground")}>{value}</p>
    </div>
  );
}

function SectionStats({ section, stats }: { section: ReportSection; stats: SummaryStats }) {
  if (section === "contacts") return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Nuovi contatti" value={String(stats.count ?? 0)} />
      <StatCard label="Score medio" value={stats.count ? `${stats.avgScore}` : "—"} />
      <StatCard label="Caldi" value={String(stats.hot ?? 0)} color="text-red-500" />
      <StatCard label="Tiepidi / Freddi" value={`${stats.warm ?? 0} / ${stats.cold ?? 0}`} />
    </div>
  );

  if (section === "deals") return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Trattative create" value={String(stats.count ?? 0)} />
      <StatCard label="Valore totale" value={formatCurrency(stats.totalValue ?? 0)} />
      <StatCard label="Vinte" value={`${stats.wonCount ?? 0} (${formatCurrency(stats.wonValue ?? 0)})`} color="text-green-600" />
      <StatCard label="Ricorrenti" value={String(stats.recurring ?? 0)} color="text-blue-500" />
    </div>
  );

  if (section === "activities") return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Totale attività" value={String(stats.count ?? 0)} />
      <StatCard label="Completate" value={String(stats.completed ?? 0)} color="text-green-600" />
      <StatCard label="Aperte" value={String(stats.open ?? 0)} color="text-yellow-600" />
      <StatCard
        label="Chiamate / Email"
        value={`${stats.byType?.call ?? 0} / ${stats.byType?.email ?? 0}`}
      />
    </div>
  );

  if (section === "quotes") return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Preventivi creati" value={String(stats.count ?? 0)} />
      <StatCard label="Accettati" value={String(stats.byStatus?.accettato ?? 0)} color="text-green-600" />
      <StatCard label="Valore accettato" value={formatCurrency(stats.acceptedValue ?? 0)} color="text-green-600" />
      <StatCard label="Tasso accettazione" value={`${stats.winRate ?? 0}%`} />
    </div>
  );

  if (section === "tasks") return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Task totali" value={String(stats.count ?? 0)} />
      <StatCard label="Completati" value={String(stats.done ?? 0)} color="text-green-600" />
      <StatCard label="Da fare" value={String(stats.todo ?? 0)} />
      <StatCard
        label="Scaduti"
        value={String(stats.overdue ?? 0)}
        color={(stats.overdue ?? 0) > 0 ? "text-red-500" : undefined}
      />
    </div>
  );

  if (section === "finance") return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Fatturato periodo" value={formatCurrency(stats.revenue ?? 0)} color="text-green-600" />
      <StatCard label="MRR Attivo" value={formatCurrency(stats.mrr ?? 0)} color="text-blue-500" />
      <StatCard label="Spese totali" value={formatCurrency(stats.expenses ?? 0)} color="text-red-500" />
      <StatCard
        label="Cash Flow"
        value={formatCurrency(stats.cashFlow ?? 0)}
        color={(stats.cashFlow ?? 0) >= 0 ? "text-green-600" : "text-red-500"}
      />
    </div>
  );

  return null;
}

interface ReportDialogProps {
  section: ReportSection;
}

export function ReportDialog({ section }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [quick, setQuick] = useState<QuickPeriod>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const getRange = useCallback((): { from: string; to: string } | null => {
    if (quick === "custom") {
      if (!customFrom || !customTo) return null;
      return { from: customFrom, to: customTo };
    }
    return periodRange(quick);
  }, [quick, customFrom, customTo]);

  const loadStats = useCallback(async () => {
    const range = getRange();
    if (!range) return;
    setLoadingStats(true);
    setStats(null);
    try {
      const res = await fetch(
        `/api/report/summary?section=${section}&from=${range.from}&to=${range.to}`
      );
      setStats(await res.json());
    } finally {
      setLoadingStats(false);
    }
  }, [section, getRange]);

  useEffect(() => {
    if (open) loadStats();
  }, [open, loadStats]);

  const handleExport = () => {
    const range = getRange();
    if (!range) return;
    window.open(
      `/api/export?type=${section}&from=${range.from}&to=${range.to}`,
      "_blank"
    );
  };

  const range = getRange();

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="cursor-pointer">
        <BarChart2 className="h-4 w-4 mr-2" />
        Report
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Report — {SECTION_LABELS[section]}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Period selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Periodo di analisi
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_OPTS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setQuick(value)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                      quick === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {quick === "custom" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  <span className="text-muted-foreground text-sm shrink-0">—</span>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              )}
              {range && (
                <p className="text-xs text-muted-foreground">
                  {range.from} → {range.to}
                </p>
              )}
            </div>

            {/* Stats preview */}
            <div className="min-h-[128px]">
              {loadingStats ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : stats ? (
                <SectionStats section={section} stats={stats} />
              ) : quick === "custom" && !range ? (
                <p className="text-sm text-muted-foreground text-center pt-8">
                  Seleziona date di inizio e fine.
                </p>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
                Chiudi
              </Button>
              <Button
                onClick={handleExport}
                disabled={!range}
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" />
                Scarica CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
