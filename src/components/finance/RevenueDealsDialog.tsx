"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp } from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Fatturato Periodo — Opportunità Vinte
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {start} → {end} · Totale: <span className="font-semibold text-green-500">{formatCurrency(totalRevenue)}</span>
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : deals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nessuna opportunità vinta nel periodo selezionato.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trattativa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Vinta il</TableHead>
                  <TableHead className="text-right">Valore/Mese</TableHead>
                  <TableHead className="text-right">Contributo Periodo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <p className="font-medium">{d.title}</p>
                      {d.contactName && (
                        <p className="text-xs text-muted-foreground">{d.contactName}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.isRecurring ? (
                        <Badge variant="outline" className="text-blue-500 border-blue-500/40 text-xs">
                          Ricorrente {d.recurringMonths ? `×${d.recurringMonths}m` : ""}
                          {d.overlapMonths && d.overlapMonths < (d.recurringMonths ?? 12) ? ` (${d.overlapMonths}m nel periodo)` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600/40 text-xs">
                          Una Tantum
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {d.wonAt ? formatDate(new Date(d.wonAt)) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {d.isRecurring ? formatCurrency(d.value) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-500">
                      {formatCurrency(d.revenueContribution)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {!loading && deals.length > 0 && (
          <div className="border-t pt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{deals.length} opportunità</span>
            <span className="font-semibold text-green-500">{formatCurrency(totalRevenue)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
