"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { RevenueForm } from "@/components/finance/RevenueForm";
import { formatCurrency, formatDate } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw, Wallet, Search, X, Receipt, Rocket, User, ArrowRight, Banknote } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { FinanceSummary, Expense, Revenue } from "@/types";
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

const EXPENSE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  spesa: { label: "Spesa", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", icon: Receipt },
  investimento: { label: "Investimento", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Rocket },
  stipendio: { label: "Stipendio", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: User },
};

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  onClick,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer hover:ring-2 hover:ring-primary/40 transition-shadow" : ""}
      onClick={onClick}
    >
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
  const router = useRouter();
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [showRevenueForm, setShowRevenueForm] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | undefined>(undefined);
  const [deletingRevenue, setDeletingRevenue] = useState<Revenue | null>(null);
  const [revenueDeleteReason, setRevenueDeleteReason] = useState("");

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
    const [summaryRes, expensesRes, revenuesRes] = await Promise.all([
      fetch(`/api/finance/summary?start=${start}&end=${end}`),
      fetch(`/api/expenses?start=${start}&end=${end}`),
      fetch("/api/revenues"),
    ]);
    const [summaryData, expensesData, revenuesData] = await Promise.all([
      summaryRes.json(),
      expensesRes.json(),
      revenuesRes.json(),
    ]);
    setSummary(summaryData);
    setExpenses(Array.isArray(expensesData) ? expensesData : []);
    setRevenues(Array.isArray(revenuesData) ? revenuesData : []);
    setLoading(false);
  }, [getRange]);

  useEffect(() => {
    loadData();
    fetch("/api/users")
      .then((r) => r.json())
      .then((users: Array<{ id: string; name: string; email: string }>) => {
        const map: Record<string, string> = {};
        for (const u of users) map[u.id] = u.name || u.email;
        setUsersMap(map);
      })
      .catch(() => {});
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

  const confirmDeleteRevenue = async () => {
    if (!deletingRevenue) return;
    if (!revenueDeleteReason.trim()) {
      toast.error("Inserisci una motivazione");
      return;
    }
    try {
      const res = await fetch(`/api/revenues/${deletingRevenue.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revenueDeleteReason.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Incasso eliminato");
      setRevenueDeleteReason("");
      loadData();
    } catch {
      toast.error("Errore durante l'eliminazione");
    } finally {
      setDeletingRevenue(null);
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
          sub={loading ? "" : `Ric: ${formatCurrency(summary?.recurringRevenue ?? 0)} · Una t.: ${formatCurrency(summary?.oneTimeRevenue ?? 0)}`}
          icon={TrendingUp}
          color="text-green-400"
          onClick={() => {
            if (loading) return;
            const { start, end } = getRange();
            router.push(`/finance/fatturato?start=${start}&end=${end}`);
          }}
        />
        <KpiCard
          title="MRR Attivo"
          value={loading ? "..." : formatCurrency(summary?.mrr ?? 0)}
          sub={loading ? "" : `ARR: ${formatCurrency((summary?.mrr ?? 0) * 12)}`}
          icon={RefreshCw}
          color="text-blue-400"
          onClick={() => !loading && router.push("/finance/mrr")}
        />
        <KpiCard
          title="Spese Periodo"
          value={loading ? "..." : formatCurrency(summary?.totalExpenses ?? 0)}
          icon={TrendingDown}
          color="text-red-400"
          onClick={() => {
            if (loading) return;
            const { start, end } = getRange();
            router.push(`/finance/spese?start=${start}&end=${end}`);
          }}
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

      {/* Revenues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Banknote className="h-4 w-4 text-green-500" />
            Incassi
          </h2>
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => { setEditingRevenue(undefined); setShowRevenueForm(true); }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Aggiungi incasso
          </Button>
        </div>

        {revenues.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
            Nessun incasso registrato. Clicca "Aggiungi incasso" per registrare il primo.
          </div>
        ) : (
          <div className="space-y-2">
            {revenues.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-colors ${r.isExternal ? "border-green-500/30" : "border-border"}`}
              >
                <div className={`shrink-0 p-2 rounded-lg ${r.isRecurring ? "bg-blue-500/10" : "bg-green-500/10"}`}>
                  {r.isRecurring
                    ? <RefreshCw className="h-4 w-4 text-blue-500" />
                    : <Banknote className="h-4 w-4 text-green-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{r.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${r.isRecurring ? "text-blue-500 border-blue-500/30" : "text-green-500 border-green-500/30"}`}>
                      {r.isRecurring ? `Ricorrente${r.recurringMonths ? ` ×${r.recurringMonths}m` : ""}` : "Una tantum"}
                    </Badge>
                    {r.isExternal && (
                      <Badge variant="outline" className="text-[10px] text-purple-500 border-purple-500/30">
                        Esterno
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">{formatDate(r.date)}</span>
                    {r.collectedBy.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        · {r.collectedBy.map((uid) => usersMap[uid] ?? uid).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right min-w-[100px]">
                  <p className="text-sm font-bold text-green-500">+{formatCurrency(r.amount)}</p>
                </div>
                <div className="shrink-0 flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 cursor-pointer"
                    onClick={() => { setEditingRevenue(r); setShowRevenueForm(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletingRevenue(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {/* Expenses */}
      <div className="space-y-3">
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
          ) : filteredExpenses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              Nessuna spesa corrisponde ai filtri.{" "}
              <button onClick={resetExpFilters} className="underline cursor-pointer">Azzera</button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredExpenses.map((exp) => {
                const cfg = EXPENSE_TYPE_CONFIG[exp.type];
                const Icon = cfg?.icon ?? Receipt;
                return (
                  <div
                    key={exp.id}
                    className={`flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-colors ${cfg?.border ?? "border-border"}`}
                  >
                    <div className={`shrink-0 p-2 rounded-lg ${cfg?.bg ?? "bg-muted"}`}>
                      <Icon className={`h-4 w-4 ${cfg?.color ?? ""}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{exp.description}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${cfg?.color ?? ""} ${cfg?.border ?? ""}`}>
                          {cfg?.label ?? exp.type}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{exp.category}</Badge>
                        <span className="text-[10px] text-muted-foreground">{formatDate(exp.date)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right min-w-[100px]">
                      <p className="text-sm font-bold text-red-500">-{formatCurrency(exp.amount)}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-0.5">
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
                  </div>
                );
              })}
            </div>
          )}
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

      <RevenueForm
        open={showRevenueForm}
        onClose={() => { setShowRevenueForm(false); setEditingRevenue(undefined); }}
        initialData={editingRevenue}
        onSaved={loadData}
      />

      <Dialog open={!!deletingRevenue} onOpenChange={(v) => !v && setDeletingRevenue(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminare l'incasso?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per eliminare <strong>{deletingRevenue?.description}</strong> ({deletingRevenue ? formatCurrency(deletingRevenue.amount) : ""}).
          </p>
          <div className="space-y-2">
            <Label>Motivazione eliminazione *</Label>
            <Textarea
              value={revenueDeleteReason}
              onChange={(e) => setRevenueDeleteReason(e.target.value)}
              rows={3}
              placeholder="Perché stai eliminando questo incasso? Es. errore registrazione, annullamento..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => { setDeletingRevenue(null); setRevenueDeleteReason(""); }}>
              Annulla
            </Button>
            <Button variant="destructive" className="cursor-pointer" onClick={confirmDeleteRevenue}>
              Elimina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
