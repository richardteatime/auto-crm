"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Plus, RefreshCw, Minus } from "lucide-react";
import { toast } from "sonner";

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // EUR
  billingType: "one_time" | "recurring";
}

export interface QuoteInitialData {
  id: string;
  title: string;
  items: QuoteItem[];
  notes: string | null;
  status: string;
  vatRate: number;
  validUntil: string;
}

interface QuoteFormProps {
  open: boolean;
  onClose: () => void;
  dealId: string;
  initialData?: QuoteInitialData;
}

const VAT_OPTIONS = [0, 4, 10, 22];
const STATUS_OPTIONS = [
  { value: "bozza", label: "Bozza" },
  { value: "inviato", label: "Inviato" },
  { value: "accettato", label: "Accettato" },
  { value: "rifiutato", label: "Rifiutato" },
];

function newItem(): QuoteItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, billingType: "one_time" };
}

export function QuoteForm({ open, onClose, dealId, initialData }: QuoteFormProps) {
  const isEditing = !!initialData?.id;

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("bozza");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(22);
  const [items, setItems] = useState<QuoteItem[]>([newItem()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setTitle(initialData.title);
      setStatus(initialData.status);
      setValidUntil(initialData.validUntil);
      setNotes(initialData.notes ?? "");
      setVatRate(initialData.vatRate);
      setItems(initialData.items.length > 0 ? initialData.items : [newItem()]);
    } else {
      setTitle("");
      setStatus("bozza");
      setValidUntil("");
      setNotes("");
      setVatRate(22);
      setItems([newItem()]);
    }
  }, [open, initialData]);

  const updateItem = (id: string, field: keyof QuoteItem, raw: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (field === "quantity") return { ...i, quantity: Math.max(1, parseFloat(raw) || 1) };
        if (field === "unitPrice") return { ...i, unitPrice: parseFloat(raw) || 0 };
        return { ...i, [field]: raw };
      })
    );
  };

  const toggleBilling = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, billingType: i.billingType === "recurring" ? "one_time" : "recurring" }
          : i
      )
    );
  };

  const removeItem = (id: string) => {
    if (items.length > 1) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const oneTimeSub = items.filter((i) => i.billingType !== "recurring").reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const recurringSub = items.filter((i) => i.billingType === "recurring").reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const subtotal = oneTimeSub + recurringSub;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;
  const hasRecurring = recurringSub > 0;
  const hasOneTime = oneTimeSub > 0;

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Inserisci un titolo per il preventivo");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        items: items.map((i) => ({
          id: i.id,
          description: i.description,
          quantity: i.quantity,
          unitPrice: Math.round(i.unitPrice * 100),
          billingType: i.billingType,
        })),
        notes: notes.trim() || null,
        status,
        vatRate,
        validUntil: validUntil || null,
      };

      const url = isEditing
        ? `/api/quotes/${initialData!.id}`
        : `/api/deals/${dealId}/quotes`;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore nel salvataggio del preventivo");
      }
      toast.success(isEditing ? "Preventivo aggiornato" : "Preventivo creato");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nel salvataggio del preventivo");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifica Preventivo" : "Nuovo Preventivo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pb-2">
          <div className="space-y-2">
            <Label htmlFor="q-title">Titolo *</Label>
            <Input
              id="q-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="es. Preventivo sviluppo sito web"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valido fino al</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Voci del preventivo</Label>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="text-left px-3 py-2 font-medium">Descrizione</th>
                    <th className="text-left px-3 py-2 font-medium w-28">Tipo</th>
                    <th className="text-right px-3 py-2 font-medium w-20">Qtà</th>
                    <th className="text-right px-3 py-2 font-medium w-32">Prezzo (€)</th>
                    <th className="text-right px-3 py-2 font-medium w-28">Totale</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-1.5">
                        <Input
                          className="h-8 border-0 shadow-none px-0 focus-visible:ring-0 bg-transparent"
                          value={item.description}
                          onChange={(e) =>
                            updateItem(item.id, "description", e.target.value)
                          }
                          placeholder="Descrizione voce"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => toggleBilling(item.id)}
                          className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer flex items-center gap-1 transition-colors ${
                            item.billingType === "recurring"
                              ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
                              : "bg-muted border-muted-foreground/20 text-muted-foreground"
                          }`}
                          title="Clicca per cambiare tipo"
                        >
                          {item.billingType === "recurring" ? (
                            <><RefreshCw className="h-2.5 w-2.5" /> /mese</>
                          ) : (
                            <><Minus className="h-2.5 w-2.5" /> Una tantum</>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          className="h-8 border-0 shadow-none px-0 focus-visible:ring-0 text-right bg-transparent"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-8 border-0 shadow-none px-0 focus-visible:ring-0 text-right bg-transparent"
                          value={item.unitPrice || ""}
                          onChange={(e) =>
                            updateItem(item.id, "unitPrice", e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        €{(item.quantity * item.unitPrice).toFixed(2)}
                      </td>
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => setItems((prev) => [...prev, newItem()])}
            >
              <Plus className="h-3.5 w-3.5" />
              Aggiungi voce
            </Button>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Label>Aliquota IVA</Label>
              <Select
                value={String(vatRate)}
                onValueChange={(v) => v && setVatRate(Number(v))}
              >
                <SelectTrigger className="cursor-pointer w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_OPTIONS.map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {v}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-right space-y-1 text-sm min-w-[220px]">
              {hasOneTime && (
                <div className="flex justify-between gap-8 text-muted-foreground">
                  <span className="flex items-center gap-1"><Minus className="h-3 w-3" /> Una tantum</span>
                  <span className="font-medium text-foreground tabular-nums">€{oneTimeSub.toFixed(2)}</span>
                </div>
              )}
              {hasRecurring && (
                <div className="flex justify-between gap-8 text-muted-foreground">
                  <span className="flex items-center gap-1 text-blue-600"><RefreshCw className="h-3 w-3" /> Ricorrente/mese</span>
                  <span className="font-medium text-blue-600 tabular-nums">€{recurringSub.toFixed(2)}/mese</span>
                </div>
              )}
              {hasOneTime && hasRecurring && (
                <div className="flex justify-between gap-8 text-muted-foreground border-t pt-1">
                  <span>Subtotale</span>
                  <span className="font-medium text-foreground tabular-nums">€{subtotal.toFixed(2)}</span>
                </div>
              )}
              {!hasOneTime && !hasRecurring && (
                <div className="flex justify-between gap-8 text-muted-foreground">
                  <span>Subtotale</span>
                  <span className="font-medium text-foreground tabular-nums">€{subtotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between gap-8 text-muted-foreground">
                <span>IVA {vatRate}%</span>
                <span className="font-medium text-foreground tabular-nums">€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-8 font-bold text-base border-t pt-2 mt-1">
                <span>Totale</span>
                <span className="text-primary tabular-nums">€{total.toFixed(2)}</span>
              </div>
              {hasRecurring && (
                <p className="text-xs text-muted-foreground pt-1">
                  + €{recurringSub.toFixed(2)}/mese (ricorrente)
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-notes">Note</Label>
            <Textarea
              id="q-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Condizioni di pagamento, termini di consegna, validità offerta..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="cursor-pointer"
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="cursor-pointer"
            >
              {submitting
                ? isEditing
                  ? "Salvataggio..."
                  : "Creazione..."
                : isEditing
                  ? "Salva modifiche"
                  : "Crea Preventivo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
