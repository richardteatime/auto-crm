"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpenseForm } from "@/components/finance/ExpenseForm";
import { formatCurrency, formatDate } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw, Wallet, Search, X } from "lucide-react";
import { toast } from "sonner";
import type { FinanceSummary, Expense } from "@/types";
import { ReportDialog } from "@/components/shared/ReportDialog";

type QuickPeriod = "month" | "quarter" | "year" | "custom";

function periodRange(type: QuickPeriod): { start: Date; end: Date } {
  const now = new Date();
  if (type === "month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    };
  }
  if (type === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return {
      start: new Date(now.getFullYear(), q * 3, 1),
      end: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59),
    };
  }
  // year
  return {
    start: new Date(now.getFullYear(), 0, 1),
    end: new Date(now.getFullYear(), 11, 31, 23, 59, 59),
  };
}

function toISO(d: Date) {
  return d.toISOString().split("T")[0];
}

const PERIOD_LABELS: Record<QuickPeriod, string> = {
  month: "Questo Mese",
  quarter: "Questo Trimestre",
  year: "Quest'Anno",
  custom: "Personalizzato",
};

const EXPENSE_TYPE_COLORS: Record<string, string> = {
  spesa: "text-red-400",
  investimento: "text-blue-400",
  stipendio: "text-yellow-400",
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  spesa: "Spesa",
  investimento: "Investimento",
  stipendio: "Stipendio",
};

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted/50 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinanceDashboard() {
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  // Expense filters
  const [expSearch, setExpSearch] = useState("");
  const [expFilterType, setExpFilterType] = useState("");
  const [expFilterCategory, setExpFilterCategory] = useState("");

  const getRange = useCallback((): { start: string; end: string } => {
    if (quickPeriod === "custom" && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    const r = periodRange(quickPeriod);
    return { start: toISO(r.start), end: toISO(r.end) };
  }, [quickPeriod, customStart, customEnd]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { start, end } = getRange();
    const [summaryRes, expensesRes] = await Promise.all([
      fetch(`/api/finance/summary?start=${start}&end=${end}`),
      fetch(`/api/expenses?start=${start}&end=${end}`),
    ]);
    const [summaryData, expensesData] = await Promise.all([
      summaryRes.json(),
      expensesRes.json(),
    ]);
    setSummary(summaryData);
    setExpenses(Array.isArray(expensesData) ? expensesData : []);
    setLoading(false);
  }, [getRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!deletingExpense) return;
    try {
      const res = await fetch(`/api/expenses/${deletingExpense.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Spesa eliminata");
      loadData();
    } catch {
      toast.error("Errore durante l'eliminazione");
    } finally {
      setDeletingExpense(null);
    }
  };

  const filteredExpenses = useMemo(() => expenses.filter((e) => {
    if (expSearch) {
      const q = expSearch.toLowerCase();
      if (!e.description.toLowerCase().includes(q) &&
          !e.category.toLowerCase().includes(q) &&
          !e.createdBy.toLowerCase().includes(q)) return false;
    }
    if (expFilterType && e.type !== expFilterType) return false;
    if (expFilterCategory && e.category !== expFilterCategory) return false;
    return true;
  }), [expenses, expSearch, expFilterType, expFilterCategory]);

  const expenseCategories = useMemo(() => [...new Set(expenses.map((e) => e.category))].sort(), [expenses]);
  const isExpFiltered = !!(expSearch || expFilterType || expFilterCategory);
  const resetExpFilters = () => { setExpSearch(""); setExpFilterType(""); setExpFilterCategory(""); };

  const chartData = summary?.monthly ?? [];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {(["month", "quarter", "year"] as QuickPeriod[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={quickPeriod === p ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setQuickPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </Button>
        ))}
        <Button
          size="sm"
          variant={quickPeriod === "custom" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setQuickPeriod("custom")}
        >
          {PERIOD_LABELS.custom}
        </Button>
        {quickPeriod === "custom" && (
          <>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
            />
            <span className="text-muted-foreground text-sm">→</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
            />
          </>
        )}
      </div>
        <ReportDialog section="finance" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Fatturato Periodo"
          value={loading ? "..." : formatCurrency(summary?.totalRevenue ?? 0)}
          sub={loading ? "" : `Una tantum: ${formatCurrency(summary?.oneTimeRevenue ?? 0)}`}
          icon={TrendingUp}
          color="text-green-400"
        />
        <KpiCard
          title="MRR Attivo"
          value={loading ? "..." : formatCurrency(summary?.mrr ?? 0)}
          sub="Ricorrente mensile attivo"
          icon={RefreshCw}
          color="text-blue-400"
        />
        <KpiCard
          title="Spese Periodo"
          value={loading ? "..." : formatCurrency(summary?.totalExpenses ?? 0)}
          icon={TrendingDown}
          color="text-red-400"
        />
        <KpiCard
          title="Cash Flow"
          value={loading ? "..." : formatCurrency(summary?.cashFlow ?? 0)}
          sub="Fatturato - Spese"
          icon={Wallet}
          color={(summary?.cashFlow ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Andamento Ultimi 12 Mesi</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v) => `€${v >= 1000 ? `${(v / 100000).toFixed(0)}k` : (v / 100).toFixed(0)}`}
                tick={{ fontSize: 11 }}
                width={48}
              />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [
                  formatCurrency(typeof value === "number" ? value : 0),
                  name === "oneTime" ? "Una Tantum" : name === "recurring" ? "Ricorrente" : "Spese",
                ]}
              />
              <Legend
                formatter={(value) =>
                  value === "oneTime" ? "Una Tantum" : value === "recurring" ? "Ricorrente" : "Spese"
                }
              />
              <Bar dataKey="oneTime" stackId="rev" fill="#22c55e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="recurring" stackId="rev" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category breakdown + Expenses table side-by-side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Spese per Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {summary && Object.keys(summary.expenseByCategory).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(summary.expenseByCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amt]) => {
                    const pct = summary.totalExpenses > 0
                      ? Math.round((amt / summary.totalExpenses) * 100)
                      : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-0.5">
                          <span>{cat}</span>
                          <span className="text-muted-foreground">{formatCurrency(amt)} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna spesa nel periodo.</p>
            )}
          </CardContent>
        </Card>

        {/* Expense Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Spese e Investimenti</h2>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={() => { setEditingExpense(undefined); setShowExpenseForm(true); }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Aggiungi
            </Button>
          </div>

          {/* Expense search + filters */}
          {expenses.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca per descrizione, categoria, inserito da..."
                    value={expSearch}
                    onChange={(e) => setExpSearch(e.target.value)}
                    className="pl-9 h-8 text-sm"
                  />
                </div>
                {isExpFiltered && (
                  <button onClick={resetExpFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer px-1">
                    <X className="h-3.5 w-3.5" /> Azzera
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[{ value: "", label: "Tutti i tipi" }, { value: "spesa", label: "Spesa" }, { value: "investimento", label: "Investimento" }, { value: "stipendio", label: "Stipendio" }].map(({ value, label }) => (
                  <button key={value} onClick={() => setExpFilterType(value)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      expFilterType === value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
                    }`}>
                    {label}
                  </button>
                ))}
                {expenseCategories.length > 0 && (
                  <>
                    <span className="text-muted-foreground text-xs self-center">|</span>
                    <button onClick={() => setExpFilterCategory("")}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                        !expFilterCategory ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
                      }`}>
                      Tutte le categorie
                    </button>
                    {expenseCategories.map((cat) => (
                      <button key={cat} onClick={() => setExpFilterCategory(expFilterCategory === cat ? "" : cat)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                          expFilterCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
                        }`}>
                        {cat}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {expenses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              Nessuna spesa nel periodo selezionato.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                        Nessuna spesa corrisponde ai filtri.
                        <button onClick={resetExpFilters} className="ml-1 underline cursor-pointer">Azzera</button>
                      </TableCell>
                    </TableRow>
                  ) : filteredExpenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(exp.date)}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${EXPENSE_TYPE_COLORS[exp.type] ?? ""}`}>
                          {EXPENSE_TYPE_LABELS[exp.type] ?? exp.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{exp.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{exp.description}</TableCell>
                      <TableCell className="text-right font-semibold text-red-400">
                        -{formatCurrency(exp.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 cursor-pointer"
                            onClick={() => { setEditingExpense(exp); setShowExpenseForm(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingExpense(exp)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {isExpFiltered && filteredExpenses.length > 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {filteredExpenses.length} di {expenses.length} spese
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <ExpenseForm
        open={showExpenseForm}
        onClose={() => { setShowExpenseForm(false); setEditingExpense(undefined); }}
        initialData={editingExpense}
        onSaved={loadData}
      />

      <Dialog open={!!deletingExpense} onOpenChange={(v) => !v && setDeletingExpense(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminare la spesa?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per eliminare <strong>{deletingExpense?.description}</strong> ({deletingExpense ? formatCurrency(deletingExpense.amount) : ""}). Questa azione è irreversibile.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => setDeletingExpense(null)}>
              Annulla
            </Button>
            <Button variant="destructive" className="cursor-pointer" onClick={confirmDelete}>
              Elimina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
