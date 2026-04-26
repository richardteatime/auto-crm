"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  FileText,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileDown,
  Search,
  X,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { ReportDialog } from "@/components/shared/ReportDialog";

interface QuoteRow {
  id: string;
  number: string;
  title: string;
  items: string;
  status: string;
  vatRate: number;
  validUntil: number | Date | null;
  createdAt: number | Date;
  dealId: string;
  dealTitle: string | null;
  contactName: string | null;
  contactCompany: string | null;
}

function calcTotal(itemsJson: string, vatRate: number): number {
  try {
    const items = JSON.parse(itemsJson) as { quantity: number; unitPrice: number }[];
    const sub = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    return sub + Math.round((sub * vatRate) / 100);
  } catch {
    return 0;
  }
}

function toMs(val: number | Date): number {
  if (val instanceof Date) return val.getTime();
  return val < 1e12 ? val * 1000 : val;
}

function isOverdue(q: QuoteRow): boolean {
  if (!q.validUntil) return false;
  if (q.status !== "bozza" && q.status !== "inviato") return false;
  return toMs(q.validUntil as number | Date) < Date.now();
}

const STATUS_CFG = {
  bozza:     { label: "Bozza",     color: "#64748b", variant: "secondary"    as const },
  inviato:   { label: "Inviato",   color: "#2563eb", variant: "outline"      as const },
  accettato: { label: "Accettato", color: "#16a34a", variant: "default"      as const },
  rifiutato: { label: "Rifiutato", color: "#dc2626", variant: "destructive"  as const },
};

const STATUSES = ["bozza", "inviato", "accettato", "rifiutato"] as const;

export default function PreventiviPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("tutti");
  const [search, setSearch] = useState("");
  const [filterValueMin, setFilterValueMin] = useState("");
  const [filterValueMax, setFilterValueMax] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);

  useEffect(() => {
    fetch("/api/quotes")
      .then((r) => r.json())
      .then((data) => {
        setQuotes(data);
        setLoading(false);
      });
  }, []);

  const kpi = useMemo(() => {
    let acceptedValue = 0;
    let acceptedCount = 0;
    let sentCount = 0;
    let overdueCount = 0;
    let nonDraftCount = 0;

    for (const q of quotes) {
      const total = calcTotal(q.items, q.vatRate);
      if (q.status === "accettato") { acceptedValue += total; acceptedCount++; }
      if (q.status === "inviato") sentCount++;
      if (q.status !== "bozza") nonDraftCount++;
      if (isOverdue(q)) overdueCount++;
    }

    const winRate = nonDraftCount > 0 ? Math.round((acceptedCount / nonDraftCount) * 100) : 0;
    return { total: quotes.length, acceptedValue, winRate, sentCount, overdueCount };
  }, [quotes]);

  const chartData = useMemo(
    () =>
      STATUSES.map((s) => {
        const rows = quotes.filter((q) => q.status === s);
        const value = rows.reduce((sum, q) => sum + calcTotal(q.items, q.vatRate), 0);
        return { name: STATUS_CFG[s].label, count: rows.length, value, color: STATUS_CFG[s].color };
      }),
    [quotes]
  );

  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = { tutti: quotes.length };
    for (const s of STATUSES) c[s] = quotes.filter((q) => q.status === s).length;
    return c;
  }, [quotes]);

  const visible = useMemo(() => {
    let base = filter === "tutti" ? quotes : quotes.filter((q) => q.status === filter);
    if (search) {
      const q = search.toLowerCase();
      base = base.filter((row) =>
        row.title.toLowerCase().includes(q) ||
        row.number.toLowerCase().includes(q) ||
        row.contactName?.toLowerCase().includes(q) ||
        row.contactCompany?.toLowerCase().includes(q) ||
        row.dealTitle?.toLowerCase().includes(q)
      );
    }
    if (filterValueMin) {
      const min = parseFloat(filterValueMin) * 100;
      base = base.filter((row) => calcTotal(row.items, row.vatRate) >= min);
    }
    if (filterValueMax) {
      const max = parseFloat(filterValueMax) * 100;
      base = base.filter((row) => calcTotal(row.items, row.vatRate) <= max);
    }
    if (filterOverdue) base = base.filter(isOverdue);
    return base;
  }, [quotes, filter, search, filterValueMin, filterValueMax, filterOverdue]);

  const isFiltered = !!(search || filterValueMin || filterValueMax || filterOverdue);
  const resetFilters = () => { setSearch(""); setFilterValueMin(""); setFilterValueMax(""); setFilterOverdue(false); };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Preventivi</h1>
          <p className="text-muted-foreground">Analisi e monitoraggio di tutti i preventivi</p>
        </div>
        <ReportDialog section="quotes" />
      </div>

      {/* Search + value filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per numero, titolo, cliente, trattativa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1">
          <Input type="number" min="0" placeholder="Min €" value={filterValueMin}
            onChange={(e) => setFilterValueMin(e.target.value)} className="h-9 w-24 text-sm" />
          <span className="text-muted-foreground text-sm">—</span>
          <Input type="number" min="0" placeholder="Max €" value={filterValueMax}
            onChange={(e) => setFilterValueMax(e.target.value)} className="h-9 w-24 text-sm" />
        </div>
        <button
          onClick={() => setFilterOverdue((v) => !v)}
          className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
            filterOverdue ? "bg-destructive text-white border-destructive" : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          Solo scaduti
        </button>
        {isFiltered && (
          <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="h-3.5 w-3.5" />
            Azzera
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              Totale
            </div>
            <p className="text-2xl font-bold">{kpi.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Valore accettato
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(kpi.acceptedValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tasso accettazione
            </div>
            <p className="text-2xl font-bold">{kpi.winRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">su preventivi inviati</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Scaduti
            </div>
            <p className="text-2xl font-bold text-destructive">{kpi.overdueCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sentCount} in attesa</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preventivi per stato</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [`${v}`, "Preventivi"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--card)",
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Valore totale per stato</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 100000
                      ? `€${(v / 100000).toFixed(0)}k`
                      : `€${(v / 100).toFixed(0)}`
                  }
                />
                <Tooltip
                  formatter={(v) => [formatCurrency(v as number), "Valore"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--card)",
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-1">
            {[{ key: "tutti", label: "Tutti" }, ...STATUSES.map((s) => ({ key: s, label: STATUS_CFG[s].label }))].map(
              (tab) => (
                <Button
                  key={tab.key}
                  variant={filter === tab.key ? "default" : "ghost"}
                  size="sm"
                  className="cursor-pointer gap-1.5"
                  onClick={() => setFilter(tab.key)}
                >
                  {tab.label}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      filter === tab.key ? "bg-white/20" : "bg-muted"
                    }`}
                  >
                    {counts[tab.key] ?? 0}
                  </span>
                </Button>
              )
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nessun preventivo in questa categoria.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Titolo</TableHead>
                  <TableHead className="hidden md:table-cell">Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Trattativa</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Valore</TableHead>
                  <TableHead className="hidden lg:table-cell">Valido fino</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((q) => {
                  const cfg =
                    STATUS_CFG[q.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.bozza;
                  const overdue = isOverdue(q);
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {q.number}
                      </TableCell>
                      <TableCell className="font-medium">{q.title}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        <div>{q.contactName ?? "—"}</div>
                        {q.contactCompany && (
                          <div className="text-muted-foreground text-xs">{q.contactCompany}</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {q.dealTitle ? (
                          <Link
                            href={`/deals/${q.dealId}`}
                            className="hover:text-primary hover:underline"
                          >
                            {q.dealTitle}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          {overdue && (
                            <span className="text-xs text-destructive font-medium flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              scaduto
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(calcTotal(q.items, q.vatRate))}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDate(q.validUntil)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer h-8 w-8"
                          onClick={() => window.open(`/api/quotes/${q.id}/pdf`, "_blank")}
                          aria-label="Scarica PDF"
                          title="Scarica PDF"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
