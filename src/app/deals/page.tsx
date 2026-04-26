"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, Briefcase, Pencil, Trash2, RefreshCw, Search, X, SlidersHorizontal } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import { DealForm, type DealInitialData } from "@/components/deals/DealForm";
import { ReportDialog } from "@/components/shared/ReportDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DealRow {
  id: string;
  title: string;
  value: number;
  probability: number;
  contactId: string;
  stageId: string;
  contactName: string | null;
  stageName: string | null;
  stageColor: string | null;
  expectedClose: number | Date | null;
  notes: string | null;
  attachments: string | null;
  isRecurring: boolean;
  recurringMonths: number | null;
  createdAt: number | Date;
}

const PROB_OPTIONS = [
  { value: 0, label: "Qualsiasi" },
  { value: 25, label: "≥ 25%" },
  { value: 50, label: "≥ 50%" },
  { value: 75, label: "≥ 75%" },
  { value: 90, label: "≥ 90%" },
];

export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealInitialData | undefined>(undefined);
  const [deletingDeal, setDeletingDeal] = useState<DealRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterTipo, setFilterTipo] = useState<"" | "one_time" | "recurring">("");
  const [filterProbMin, setFilterProbMin] = useState(0);
  const [filterValueMin, setFilterValueMin] = useState("");
  const [filterValueMax, setFilterValueMax] = useState("");
  const [filterCloseFrom, setFilterCloseFrom] = useState("");
  const [filterCloseTo, setFilterCloseTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadDeals = () => {
    fetch("/api/deals")
      .then((res) => res.json())
      .then((data) => { setDeals(data); setLoading(false); });
  };

  useEffect(() => { loadDeals(); }, []);

  const stages = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>();
    for (const d of deals) {
      if (d.stageId && d.stageName && !seen.has(d.stageId))
        seen.set(d.stageId, { id: d.stageId, name: d.stageName, color: d.stageColor ?? "#64748b" });
    }
    return Array.from(seen.values());
  }, [deals]);

  const filtered = useMemo(() => deals.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.title.toLowerCase().includes(q) && !d.contactName?.toLowerCase().includes(q)) return false;
    }
    if (filterStage && d.stageId !== filterStage) return false;
    if (filterTipo === "one_time" && d.isRecurring) return false;
    if (filterTipo === "recurring" && !d.isRecurring) return false;
    if (filterProbMin > 0 && d.probability < filterProbMin) return false;
    if (filterValueMin) {
      const min = parseFloat(filterValueMin) * 100;
      if (d.value < min) return false;
    }
    if (filterValueMax) {
      const max = parseFloat(filterValueMax) * 100;
      if (d.value > max) return false;
    }
    if (filterCloseFrom && d.expectedClose) {
      const from = new Date(filterCloseFrom).getTime();
      const val = typeof d.expectedClose === "number"
        ? (d.expectedClose < 1e12 ? d.expectedClose * 1000 : d.expectedClose)
        : (d.expectedClose as Date).getTime();
      if (val < from) return false;
    }
    if (filterCloseTo && d.expectedClose) {
      const to = new Date(filterCloseTo).getTime() + 86399999;
      const val = typeof d.expectedClose === "number"
        ? (d.expectedClose < 1e12 ? d.expectedClose * 1000 : d.expectedClose)
        : (d.expectedClose as Date).getTime();
      if (val > to) return false;
    }
    return true;
  }), [deals, search, filterStage, filterTipo, filterProbMin, filterValueMin, filterValueMax, filterCloseFrom, filterCloseTo]);

  const isFiltered = !!(search || filterStage || filterTipo || filterProbMin || filterValueMin || filterValueMax || filterCloseFrom || filterCloseTo);

  const resetFilters = () => {
    setSearch(""); setFilterStage(""); setFilterTipo(""); setFilterProbMin(0);
    setFilterValueMin(""); setFilterValueMax(""); setFilterCloseFrom(""); setFilterCloseTo("");
  };

  const openCreate = () => { setEditingDeal(undefined); setShowForm(true); };
  const openEdit = (e: React.MouseEvent, deal: DealRow) => {
    e.stopPropagation();
    setEditingDeal({
      id: deal.id, title: deal.title, value: deal.value, contactId: deal.contactId,
      stageId: deal.stageId, probability: deal.probability, expectedClose: deal.expectedClose,
      notes: deal.notes, attachments: deal.attachments, isRecurring: deal.isRecurring,
      recurringMonths: deal.recurringMonths,
    });
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!deletingDeal) return;
    try {
      const res = await fetch(`/api/deals/${deletingDeal.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeals((prev) => prev.filter((d) => d.id !== deletingDeal.id));
      toast.success("Trattativa eliminata");
    } catch {
      toast.error("Errore durante l'eliminazione");
    } finally {
      setDeletingDeal(null);
    }
  };

  const onClose = () => { setShowForm(false); setEditingDeal(undefined); loadDeals(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trattative</h1>
          <p className="text-muted-foreground">Opportunità di vendita attive</p>
        </div>
        <div className="flex gap-2">
          <ReportDialog section="deals" />
          <Button onClick={openCreate} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Nuova Trattativa
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per titolo o contatto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showAdvanced ? "default" : "outline"}
            size="sm"
            className="cursor-pointer gap-1.5 shrink-0"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtri
            {isFiltered && (
              <span className="bg-primary-foreground text-primary rounded-full w-4 h-4 text-xs flex items-center justify-center font-bold">
                {[filterStage, filterTipo, filterProbMin > 0, filterValueMin, filterValueMax, filterCloseFrom, filterCloseTo].filter(Boolean).length}
              </span>
            )}
          </Button>
        </div>

        {/* Stage + Tipo quick chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterTipo("")}
            className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
              filterTipo === "" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
          >
            Tutti ({deals.length})
          </button>
          <button
            onClick={() => setFilterTipo("one_time")}
            className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
              filterTipo === "one_time" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
          >
            Una Tantum ({deals.filter((d) => !d.isRecurring).length})
          </button>
          <button
            onClick={() => setFilterTipo("recurring")}
            className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1",
              filterTipo === "recurring" ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground hover:bg-muted")}
          >
            <RefreshCw className="h-3 w-3" />
            Ricorrenti ({deals.filter((d) => d.isRecurring).length})
          </button>
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilterStage(filterStage === s.id ? "" : s.id)}
              className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                filterStage === s.id ? "text-white border-transparent" : "border-border text-muted-foreground hover:bg-muted")}
              style={filterStage === s.id ? { backgroundColor: s.color, borderColor: s.color } : {}}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valore (EUR)</p>
                <div className="flex gap-1 items-center">
                  <Input type="number" min="0" placeholder="Min" value={filterValueMin}
                    onChange={(e) => setFilterValueMin(e.target.value)} className="h-8 text-sm" />
                  <span className="text-muted-foreground text-sm">—</span>
                  <Input type="number" min="0" placeholder="Max" value={filterValueMax}
                    onChange={(e) => setFilterValueMax(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Probabilità</p>
                <div className="flex flex-wrap gap-1">
                  {PROB_OPTIONS.map(({ value, label }) => (
                    <button key={value} onClick={() => setFilterProbMin(value)}
                      className={cn("px-2 py-0.5 rounded text-xs border transition-colors cursor-pointer",
                        filterProbMin === value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chiusura stimata</p>
                <div className="flex gap-1 items-center">
                  <Input type="date" value={filterCloseFrom} onChange={(e) => setFilterCloseFrom(e.target.value)} className="h-8 text-sm" />
                  <span className="text-muted-foreground text-sm">—</span>
                  <Input type="date" value={filterCloseTo} onChange={(e) => setFilterCloseTo(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>

              <div className="flex items-end">
                {isFiltered && (
                  <button onClick={resetFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                    <X className="h-3.5 w-3.5" />
                    Azzera filtri
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          icon={Briefcase} title="Nessuna trattativa"
          description="Crea la tua prima trattativa per iniziare a gestire il tuo pipeline."
          actionLabel="Crea trattativa" onAction={openCreate}
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Contatto</TableHead>
                  <TableHead>Valore</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead className="hidden md:table-cell">Probabilità</TableHead>
                  <TableHead className="hidden lg:table-cell">Chiusura stim.</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                      Nessuna trattativa corrisponde ai filtri applicati.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((deal) => (
                    <TableRow key={deal.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/deals/${deal.id}`)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {deal.title}
                          {deal.isRecurring && (
                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                              <RefreshCw className="h-2.5 w-2.5" />
                              {deal.recurringMonths ?? 12}m
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{deal.contactName || "-"}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatCurrency(deal.value)}{deal.isRecurring ? "/mo" : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" style={{ borderColor: deal.stageColor || undefined, color: deal.stageColor || undefined }}>
                          {deal.stageName}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{deal.probability}%</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDate(deal.expectedClose)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8"
                            onClick={(e) => openEdit(e, deal)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            className="cursor-pointer h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeletingDeal(deal); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {filtered.length} di {deals.length} trattative
            {isFiltered && (
              <button onClick={resetFilters} className="ml-2 underline cursor-pointer hover:text-foreground">
                azzera filtri
              </button>
            )}
          </p>
        </>
      )}

      <DealForm open={showForm} onClose={onClose} initialData={editingDeal} />

      <Dialog open={!!deletingDeal} onOpenChange={(v) => !v && setDeletingDeal(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Eliminare la trattativa?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per eliminare <strong>{deletingDeal?.title}</strong> ({deletingDeal ? formatCurrency(deletingDeal.value) : ""}). Questa azione è irreversibile.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => setDeletingDeal(null)}>Annulla</Button>
            <Button variant="destructive" className="cursor-pointer" onClick={confirmDelete}>Elimina</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
