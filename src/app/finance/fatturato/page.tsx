"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, RefreshCw, Zap, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";

interface RevenueDeal {
  id: string;
  title: string;
  contactName: string | null;
  value: number;
  isRecurring: boolean;
  recurringMonths: number | null;
  revenueContribution: number;
  overlapMonths: number | null;
  wonAt: string | null;
  isPaid: boolean;
}

function FatturatoContent() {
  const router = useRouter();
  const params = useSearchParams();
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";

  const [deals, setDeals] = useState<RevenueDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!start || !end) return;
    setLoading(true);
    fetch(`/api/finance/deals?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data) => setDeals(data.deals ?? []))
      .finally(() => setLoading(false));
  }, [start, end]);

  const totalRevenue = deals.reduce((s, d) => s + d.revenueContribution, 0);
  const totalOneTime = deals.filter((d) => !d.isRecurring).reduce((s, d) => s + d.revenueContribution, 0);
  const totalRecurring = deals.filter((d) => d.isRecurring).reduce((s, d) => s + d.revenueContribution, 0);

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
            <TrendingUp className="h-5 w-5 text-green-500" />
            Fatturato Periodo — Opportunità Vinte
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
            <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2.5">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Totale periodo</span>
              <span className="text-xl font-bold text-green-500">{formatCurrency(totalRevenue)}</span>
            </div>
            {totalOneTime > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-muted/60 border px-4 py-2.5">
                <Zap className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Una tantum</span>
                <span className="text-lg font-semibold text-green-600">{formatCurrency(totalOneTime)}</span>
              </div>
            )}
            {totalRecurring > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-muted/60 border px-4 py-2.5">
                <RefreshCw className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Ricorrente</span>
                <span className="text-lg font-semibold text-blue-500">{formatCurrency(totalRecurring)}</span>
              </div>
            )}
          </div>
        )}

        {/* Deals list */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : deals.length === 0 ? (
          <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground">
            Nessuna opportunità vinta nel periodo selezionato.
          </div>
        ) : (
          <div className="space-y-3">
            {deals.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                {/* Icon */}
                <div className={`shrink-0 p-2.5 rounded-xl ${d.isRecurring ? "bg-blue-500/10" : "bg-green-500/10"}`}>
                  {d.isRecurring
                    ? <RefreshCw className="h-5 w-5 text-blue-500" />
                    : <Zap className="h-5 w-5 text-green-600" />
                  }
                </div>

                {/* Name + client */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate">{d.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{d.contactName ?? "—"}</p>
                </div>

                {/* Type badge */}
                <div className="shrink-0">
                  {d.isRecurring ? (
                    <Badge variant="outline" className="text-blue-500 border-blue-500/40 whitespace-nowrap">
                      Ricorrente {d.recurringMonths ? `×${d.recurringMonths}m` : ""}
                      {d.overlapMonths && d.overlapMonths < (d.recurringMonths ?? 12)
                        ? ` · ${d.overlapMonths}m`
                        : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600 border-green-600/40">
                      Una Tantum
                    </Badge>
                  )}
                </div>

                {/* Won date */}
                <div className="shrink-0 text-right hidden sm:block min-w-[100px]">
                  <p className="text-xs text-muted-foreground">Vinta il</p>
                  <p className="text-sm font-medium">
                    {d.wonAt ? formatDate(new Date(d.wonAt)) : "—"}
                  </p>
                </div>

                {/* €/mese — recurring only */}
                <div className="shrink-0 text-right hidden md:block min-w-[90px]">
                  {d.isRecurring ? (
                    <>
                      <p className="text-xs text-muted-foreground">€/mese</p>
                      <p className="text-sm font-medium text-blue-500">{formatCurrency(d.value)}</p>
                    </>
                  ) : null}
                </div>

                {/* Total contribution */}
                <div className="shrink-0 text-right min-w-[110px]">
                  <p className="text-xs text-muted-foreground">Totale periodo</p>
                  <p className="text-xl font-bold text-green-500">{formatCurrency(d.revenueContribution)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer total */}
        {!loading && deals.length > 0 && (
          <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
            <span>{deals.length} opportunità vinte</span>
            <span className="text-xl font-bold text-green-500">{formatCurrency(totalRevenue)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FatturatoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <FatturatoContent />
    </Suspense>
  );
}
