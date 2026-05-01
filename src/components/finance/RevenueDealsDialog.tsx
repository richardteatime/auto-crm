"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, RefreshCw, Zap } from "lucide-react";
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

interface RevenueDealsDialogProps {
  open: boolean;
  onClose: () => void;
  start: string;
  end: string;
  totalRevenue: number;
}

export function RevenueDealsDialog({ open, onClose, start, end, totalRevenue }: RevenueDealsDialogProps) {
  const [deals, setDeals] = useState<RevenueDeal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/finance/deals?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data) => setDeals(data.deals ?? []))
      .finally(() => setLoading(false));
  }, [open, start, end]);

  const totalOneTime = deals.filter((d) => !d.isRecurring).reduce((s, d) => s + d.revenueContribution, 0);
  const totalRecurring = deals.filter((d) => d.isRecurring).reduce((s, d) => s + d.revenueContribution, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Fatturato Periodo — Opportunità Vinte
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {start} → {end}
          </p>

          {/* Summary pills */}
          {!loading && deals.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              <div className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs text-muted-foreground">Totale periodo</span>
                <span className="text-sm font-bold text-green-500">{formatCurrency(totalRevenue)}</span>
              </div>
              {totalOneTime > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-1.5">
                  <Zap className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs text-muted-foreground">Una tantum</span>
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(totalOneTime)}</span>
                </div>
              )}
              {totalRecurring > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Ricorrente</span>
                  <span className="text-sm font-semibold text-blue-500">{formatCurrency(totalRecurring)}</span>
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-auto min-h-0 px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : deals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nessuna opportunità vinta nel periodo selezionato.
            </p>
          ) : (
            <div className="space-y-2">
              {deals.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  {/* Type icon */}
                  <div className={`shrink-0 p-2 rounded-lg ${d.isRecurring ? "bg-blue-500/10" : "bg-green-500/10"}`}>
                    {d.isRecurring
                      ? <RefreshCw className="h-4 w-4 text-blue-500" />
                      : <Zap className="h-4 w-4 text-green-600" />
                    }
                  </div>

                  {/* Name + client */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{d.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {d.contactName ?? "—"}
                    </p>
                  </div>

                  {/* Type badge */}
                  <div className="shrink-0 hidden sm:block">
                    {d.isRecurring ? (
                      <Badge variant="outline" className="text-blue-500 border-blue-500/40 text-xs whitespace-nowrap">
                        Ricorrente {d.recurringMonths ? `×${d.recurringMonths}m` : ""}
                        {d.overlapMonths && d.overlapMonths < (d.recurringMonths ?? 12)
                          ? ` · ${d.overlapMonths}m nel periodo`
                          : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-600/40 text-xs">
                        Una Tantum
                      </Badge>
                    )}
                  </div>

                  {/* Won date */}
                  <div className="shrink-0 text-right hidden md:block">
                    <p className="text-xs text-muted-foreground">Vinta il</p>
                    <p className="text-sm font-medium">
                      {d.wonAt ? formatDate(new Date(d.wonAt)) : "—"}
                    </p>
                  </div>

                  {/* Value/month (recurring only) */}
                  {d.isRecurring && (
                    <div className="shrink-0 text-right hidden lg:block">
                      <p className="text-xs text-muted-foreground">€/mese</p>
                      <p className="text-sm font-medium text-blue-500">{formatCurrency(d.value)}</p>
                    </div>
                  )}

                  {/* Revenue contribution */}
                  <div className="shrink-0 text-right min-w-[90px]">
                    <p className="text-xs text-muted-foreground">Totale periodo</p>
                    <p className="text-base font-bold text-green-500">{formatCurrency(d.revenueContribution)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && deals.length > 0 && (
          <div className="border-t px-6 py-3 shrink-0 flex items-center justify-between text-sm bg-muted/20">
            <span className="text-muted-foreground">{deals.length} opportunità vinte</span>
            <span className="font-bold text-green-500 text-base">{formatCurrency(totalRevenue)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
