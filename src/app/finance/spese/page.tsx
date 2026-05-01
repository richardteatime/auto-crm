"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, TrendingDown, Loader2, Search, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import type { Expense } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  spesa: "Spesa",
  investimento: "Investimento",
  stipendio: "Stipendio",
};

const TYPE_COLORS: Record<string, string> = {
  spesa: "text-red-500 border-red-500/40",
  investimento: "text-blue-500 border-blue-500/40",
  stipendio: "text-yellow-500 border-yellow-500/40",
};

function SpeseContent() {
  const router = useRouter();
  const params = useSearchParams();
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  useEffect(() => {
    if (!start || !end) return;
    setLoading(true);
    fetch(`/api/expenses?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data) => setExpenses(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [start, end]);

  const categories = useMemo(() => [...new Set(expenses.map((e) => e.category))].sort(), [expenses]);

  const filtered = useMemo(() => expenses.filter((e) => {
    if (search) {
      const q = search.toLowerCase();
      if (!e.description.toLowerCase().includes(q) &&
          !e.category.toLowerCase().includes(q) &&
          !e.createdBy.toLowerCase().includes(q)) return false;
    }
    if (filterType && e.type !== filterType) return false;
    if (filterCategory && e.category !== filterCategory) return false;
    return true;
  }), [expenses, search, filterType, filterCategory]);

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0);
  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach((e) => { m[e.type] = (m[e.type] ?? 0) + e.amount; });
    return m;
  }, [expenses]);

  const isFiltered = !!(search || filterType || filterCategory);
  const reset = () => { setSearch(""); setFilterType(""); setFilterCategory(""); };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 sm:px-8 py-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" className="cursor-pointer gap-1.5" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Finance
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Spese Periodo
          </h1>
          {start && end && (
            <p className="text-sm text-muted-foreground">{start} → {end}</p>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6 max-w-5xl mx-auto space-y-6">
        {/* Summary pills */}
        {!loading && (
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Totale spese</span>
              <span className="text-xl font-bold text-red-500">{formatCurrency(totalAll)}</span>
            </div>
            {Object.entries(byType).map(([type, amt]) => (
              <div key={type} className="flex items-center gap-2 rounded-xl bg-muted/60 border px-4 py-2.5">
                <span className="text-sm text-muted-foreground">{TYPE_LABELS[type] ?? type}</span>
                <span className="text-lg font-semibold">{formatCurrency(amt)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-xl bg-muted/60 border px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Voci</span>
              <span className="text-lg font-bold">{expenses.length}</span>
            </div>
          </div>
        )}

        {/* Filters */}
        {!loading && expenses.length > 0 && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca descrizione, categoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              {isFiltered && (
                <Button variant="ghost" size="sm" className="cursor-pointer gap-1" onClick={reset}>
                  <X className="h-3.5 w-3.5" /> Azzera
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[{ value: "", label: "Tutti i tipi" }, { value: "spesa", label: "Spesa" }, { value: "investimento", label: "Investimento" }, { value: "stipendio", label: "Stipendio" }].map(({ value, label }) => (
                <button key={value} onClick={() => setFilterType(value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${filterType === value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {label}
                </button>
              ))}
              {categories.length > 1 && (
                <>
                  <span className="text-muted-foreground text-xs self-center mx-1">|</span>
                  {categories.map((cat) => (
                    <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${filterCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                      {cat}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground">
            Nessuna spesa nel periodo selezionato.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
            Nessuna spesa corrisponde ai filtri.{" "}
            <button onClick={reset} className="underline cursor-pointer hover:text-foreground">Azzera</button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <div key={e.id} className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 hover:bg-muted/30 transition-colors">
                {/* Type icon area */}
                <div className="shrink-0 p-2.5 rounded-xl bg-red-500/10">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>

                {/* Description + category */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate">{e.description}</p>
                  <p className="text-sm text-muted-foreground">{e.createdBy}</p>
                </div>

                {/* Type badge */}
                <div className="shrink-0 hidden sm:block">
                  <Badge variant="outline" className={`text-xs ${TYPE_COLORS[e.type] ?? ""}`}>
                    {TYPE_LABELS[e.type] ?? e.type}
                  </Badge>
                </div>

                {/* Category */}
                <div className="shrink-0 hidden md:block">
                  <Badge variant="secondary" className="text-xs">{e.category}</Badge>
                </div>

                {/* Date */}
                <div className="shrink-0 text-right hidden sm:block min-w-[100px]">
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-sm font-medium">{formatDate(e.date)}</p>
                </div>

                {/* Amount */}
                <div className="shrink-0 text-right min-w-[110px]">
                  <p className="text-xs text-muted-foreground">Importo</p>
                  <p className="text-xl font-bold text-red-500">-{formatCurrency(e.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
            <span>
              {isFiltered ? `${filtered.length} di ${expenses.length} voci` : `${expenses.length} voci`}
            </span>
            <div className="text-right">
              {isFiltered && filtered.length !== expenses.length && (
                <span className="text-xs mr-2 text-muted-foreground">Filtrate: {formatCurrency(totalFiltered)}</span>
              )}
              <span className="text-xl font-bold text-red-500">-{formatCurrency(totalAll)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SpesePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <SpeseContent />
    </Suspense>
  );
}
