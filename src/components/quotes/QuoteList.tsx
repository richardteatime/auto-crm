"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, FileDown, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import { toast } from "sonner";
import { QuoteForm, type QuoteInitialData } from "./QuoteForm";

interface DbQuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // cents
  billingType?: "one_time" | "recurring";
}

interface QuoteRow {
  id: string;
  number: string;
  title: string;
  items: string;
  notes: string | null;
  status: string;
  vatRate: number;
  validUntil: number | Date | null;
  createdAt: number | Date;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  bozza: { label: "Bozza", variant: "secondary" },
  inviato: { label: "Inviato", variant: "outline" },
  accettato: { label: "Accettato", variant: "default" },
  rifiutato: { label: "Rifiutato", variant: "destructive" },
};

function calcTotal(q: QuoteRow): number {
  try {
    const items = JSON.parse(q.items) as DbQuoteItem[];
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    return subtotal + Math.round((subtotal * q.vatRate) / 100);
  } catch {
    return 0;
  }
}

function parseItemsForForm(itemsJson: string): QuoteInitialData["items"] {
  try {
    return (JSON.parse(itemsJson) as DbQuoteItem[]).map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice / 100,
      billingType: i.billingType ?? "one_time",
    }));
  } catch {
    return [];
  }
}

function toDateInputValue(val: number | Date | null | undefined): string {
  if (!val) return "";
  const d =
    val instanceof Date
      ? val
      : new Date(typeof val === "number" && val < 1e12 ? val * 1000 : val);
  return d.toISOString().split("T")[0];
}

interface QuoteListProps {
  dealId: string;
}

export function QuoteList({ dealId }: QuoteListProps) {
  const [quoteList, setQuoteList] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuoteInitialData | undefined>(undefined);
  const [deletingQuote, setDeletingQuote] = useState<QuoteRow | null>(null);

  const load = () => {
    fetch(`/api/deals/${dealId}/quotes`)
      .then((r) => r.json())
      .then((data) => {
        setQuoteList(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, [dealId]);

  const openCreate = () => {
    setEditingQuote(undefined);
    setShowForm(true);
  };

  const openEdit = (e: React.MouseEvent, q: QuoteRow) => {
    e.stopPropagation();
    setEditingQuote({
      id: q.id,
      title: q.title,
      items: parseItemsForForm(q.items),
      notes: q.notes,
      status: q.status,
      vatRate: q.vatRate,
      validUntil: toDateInputValue(q.validUntil),
    });
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!deletingQuote) return;
    try {
      const res = await fetch(`/api/quotes/${deletingQuote.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setQuoteList((prev) => prev.filter((q) => q.id !== deletingQuote.id));
      toast.success("Preventivo eliminato");
    } catch {
      toast.error("Errore durante l'eliminazione");
    } finally {
      setDeletingQuote(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Preventivi ({quoteList.length})
          </CardTitle>
          <Button size="sm" className="cursor-pointer gap-2" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Nuovo Preventivo
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : quoteList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nessun preventivo per questa trattativa.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  <TableHead className="hidden md:table-cell">Valido fino</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quoteList.map((q) => {
                  const cfg = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.bozza;
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {q.number}
                      </TableCell>
                      <TableCell className="font-medium">{q.title}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(calcTotal(q))}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDate(q.validUntil)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer h-8 w-8"
                            onClick={() =>
                              window.open(`/api/quotes/${q.id}/pdf`, "_blank")
                            }
                            aria-label="Scarica PDF"
                            title="Scarica PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer h-8 w-8"
                            onClick={(e) => openEdit(e, q)}
                            aria-label="Modifica preventivo"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingQuote(q);
                            }}
                            aria-label="Elimina preventivo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <QuoteForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingQuote(undefined);
          load();
        }}
        dealId={dealId}
        initialData={editingQuote}
      />

      <Dialog
        open={!!deletingQuote}
        onOpenChange={(v) => !v && setDeletingQuote(null)}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminare il preventivo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per eliminare <strong>{deletingQuote?.number}</strong> —{" "}
            {deletingQuote?.title}. Questa azione è irreversibile.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setDeletingQuote(null)}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={confirmDelete}
            >
              Elimina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
