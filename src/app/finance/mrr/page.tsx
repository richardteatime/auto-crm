"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Loader2, CalendarRange } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";

interface MrrDeal {
  id: string;
  title: string;
  contactName: string | null;
  value: number;
  recurringMonths: number;
  startDate: string;
  endDate: string;
  totalContractValue: number;
  wonAt: string | null;
}

export default function MrrPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<MrrDeal[]>([]);
  const [totalMrr, setTotalMrr] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finance/mrr")
      .then((r) => r.json())
      .then((data) => {
        setDeals(data.deals ?? []);
        setTotalMrr(data.totalMrr ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalArr = totalMrr * 12;
  const totalContractValue = deals.reduce((s, d) => s + d.totalContractValue, 0);

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
            <RefreshCw className="h-5 w-5 text-blue-500" />
            MRR Attivo — Contratti Ricorrenti
          </h1>
          <p className="text-sm text-muted-foreground">Tutti i contratti ricorrenti attivi oggi</p>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6 max-w-5xl mx-auto space-y-6">
        {/* Summary pills */}
        {!loading && (
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5">
              <RefreshCw className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">MRR Totale</span>
              <span className="text-xl font-bold text-blue-500">{formatCurrency(totalMrr)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/60 border px-4 py-2.5">
              <CalendarRange className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-muted-foreground">ARR</span>
              <span className="text-lg font-semibold text-blue-400">{formatCurrency(totalArr)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/60 border px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Valore totale contratti</span>
              <span className="text-lg font-semibold">{formatCurrency(totalContractValue)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/60 border px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Contratti attivi</span>
              <span className="text-lg font-bold">{deals.length}</span>
            </div>
          </div>
        )}

        {/* Deals list */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : deals.length === 0 ? (
          <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground">
            Nessun contratto ricorrente attivo al momento.
          </div>
        ) : (
          <div className="space-y-3">
            {deals.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                {/* Icon */}
                <div className="shrink-0 p-2.5 rounded-xl bg-blue-500/10">
                  <RefreshCw className="h-5 w-5 text-blue-500" />
                </div>

                {/* Name + client */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate">{d.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{d.contactName ?? "—"}</p>
                </div>

                {/* Duration badge */}
                <div className="shrink-0 hidden sm:block">
                  <Badge variant="outline" className="text-blue-500 border-blue-500/40 whitespace-nowrap">
                    ×{d.recurringMonths} mesi
                  </Badge>
                </div>

                {/* Period */}
                <div className="shrink-0 text-right hidden md:block min-w-[160px]">
                  <p className="text-xs text-muted-foreground">Periodo</p>
                  <p className="text-sm font-medium">
                    {formatDate(new Date(d.startDate))} → {formatDate(new Date(d.endDate))}
                  </p>
                </div>

                {/* Total contract value */}
                <div className="shrink-0 text-right hidden sm:block min-w-[110px]">
                  <p className="text-xs text-muted-foreground">Valore contratto</p>
                  <p className="text-sm font-medium">{formatCurrency(d.totalContractValue)}</p>
                </div>

                {/* MRR contribution */}
                <div className="shrink-0 text-right min-w-[110px]">
                  <p className="text-xs text-muted-foreground">MRR / mese</p>
                  <p className="text-xl font-bold text-blue-500">{formatCurrency(d.value)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {!loading && deals.length > 0 && (
          <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
            <span>{deals.length} contratti ricorrenti attivi</span>
            <div className="text-right">
              <span className="text-xs mr-2">MRR</span>
              <span className="text-xl font-bold text-blue-500">{formatCurrency(totalMrr)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
