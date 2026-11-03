"use client";

import { useState, useEffect, useRef } from "react";
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
import { Trash2, Plus, RefreshCw, Minus, Sparkles, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import type { FormQuoteItem } from "@/lib/quote-items";
import {
  PAYMENT_METHODS,
  INSTALLMENT_OPTIONS,
  DEPOSIT_OPTIONS,
  DEFAULT_PAYMENT_TERMS,
  buildPaymentSchedule,
  describePaymentTerms,
  type PaymentTerms,
  type PaymentMethod,
} from "@/lib/quote-payment";

export type QuoteItem = FormQuoteItem;

export interface QuoteInitialData {
  id: string;
  title: string;
  items: QuoteItem[];
  notes: string | null;
  paymentTerms?: PaymentTerms | null;
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

const eur = (v: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);

function newItem(): QuoteItem {
  return { id: crypto.randomUUID(), description: "", details: "", quantity: 1, unitPrice: 0, discount: 0, billingType: "una_tantum" };
}

export function QuoteForm({ open, onClose, dealId, initialData }: QuoteFormProps) {
  const isEditing = !!initialData?.id;

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("bozza");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(22);
  const [items, setItems] = useState<QuoteItem[]>([newItem()]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(DEFAULT_PAYMENT_TERMS);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  // Service name for which each row last received an automatic description,
  // so leaving the field again does not trigger a second call.
  const autoDone = useRef<Record<string, string>>({});

  const setupItem = items.find((i) => i.isSetup);
  const normalItems = items.filter((i) => !i.isSetup);

  useEffect(() => {
    if (!open) return;
    autoDone.current = {};
    setGenerating({});
    if (initialData) {
      setTitle(initialData.title);
      setStatus(initialData.status);
      setValidUntil(initialData.validUntil);
      setNotes(initialData.notes ?? "");
      setVatRate(initialData.vatRate);
      setPaymentTerms(initialData.paymentTerms ?? DEFAULT_PAYMENT_TERMS);
      const loaded = initialData.items.length > 0 ? initialData.items : [newItem()];
      setItems(loaded.map((i) => ({ ...i, details: i.details ?? "" })));
    } else {
      setTitle("");
      setStatus("bozza");
      setValidUntil("");
      setNotes("");
      setVatRate(22);
      setPaymentTerms(DEFAULT_PAYMENT_TERMS);
      setItems([newItem()]);
    }
  }, [open, initialData]);

  const updateItem = (id: string, field: keyof QuoteItem, raw: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (field === "quantity") return { ...i, quantity: Math.max(1, parseFloat(raw) || 1) };
        if (field === "unitPrice") return { ...i, unitPrice: parseFloat(raw) || 0 };
        if (field === "discount") return { ...i, discount: Math.min(100, Math.max(0, parseFloat(raw) || 0)) };
        return { ...i, [field]: raw };
      })
    );
  };

  const toggleBilling = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, billingType: i.billingType === "una_tantum" ? "mensile" : i.billingType === "mensile" ? "annuale" : "una_tantum" }
          : i
      )
    );
  };

  const removeItem = (id: string) => {
    if (normalItems.length > 1 || items.find((i) => i.id === id)?.isSetup) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  // -------------------------------------------------------------------------
  // Automatic line descriptions
  // -------------------------------------------------------------------------

  const generateDetails = async (item: QuoteItem, opts: { force?: boolean; auto?: boolean } = {}) => {
    const service = item.description.trim();
    if (service.length < 3) {
      if (!opts.auto) toast.error("Scrivi prima il nome del servizio");
      return;
    }
    if (generating[item.id]) return;
    autoDone.current[item.id] = service;
    setGenerating((g) => ({ ...g, [item.id]: true }));
    try {
      const res = await fetch("/api/quotes/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service,
          quoteTitle: title.trim(),
          dealId,
          otherServices: items.filter((i) => i.id !== item.id).map((i) => i.description),
          force: !!opts.force,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.details) throw new Error(data.error || "Generazione non riuscita");
      // Do not overwrite text the user typed while the request was running.
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id && (opts.force || !i.details?.trim()) ? { ...i, details: data.details } : i
        )
      );
      if (!opts.auto || data.source === "storico") {
        toast.success(
          data.source === "storico"
            ? `Descrizione ripresa dal preventivo ${data.quoteNumber ?? "precedente"}`
            : "Descrizione generata"
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generazione non riuscita");
    } finally {
      setGenerating((g) => ({ ...g, [item.id]: false }));
    }
  };

  const autoGenerate = (item: QuoteItem) => {
    const service = item.description.trim();
    if (service.length < 3 || item.details?.trim()) return;
    if (autoDone.current[item.id] === service) return;
    void generateDetails(item, { auto: true });
  };

  // -------------------------------------------------------------------------
  // Totals (same rules as the PDF: first year = one-off + 12 months + 1 year)
  // -------------------------------------------------------------------------

  const lineTotal = (i: QuoteItem) => i.quantity * i.unitPrice * (1 - i.discount / 100);
  const netPrice = (i: QuoteItem) => i.unitPrice * (1 - i.discount / 100);

  const setupLineTotal = setupItem ? setupItem.unitPrice * (1 - setupItem.discount / 100) : 0;
  const oneTimeSub = normalItems.filter((i) => i.billingType === "una_tantum").reduce((s, i) => s + lineTotal(i), 0);
  const monthlySub = normalItems.filter((i) => i.billingType === "mensile").reduce((s, i) => s + lineTotal(i), 0);
  const annualSub = normalItems.filter((i) => i.billingType === "annuale").reduce((s, i) => s + lineTotal(i), 0);
  const subtotal = setupLineTotal + oneTimeSub + monthlySub * 12 + annualSub;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;
  const hasOneTime = oneTimeSub > 0;

  const oneOffCents = Math.round((setupLineTotal + oneTimeSub) * 100 * (1 + vatRate / 100));
  const schedule = buildPaymentSchedule(paymentTerms, oneOffCents);

  const setMethod = (method: PaymentMethod) => {
    setPaymentTerms((prev) => ({
      method,
      installments: method === "rate" ? prev.installments ?? 3 : undefined,
      depositPercent: method === "acconto_saldo" ? prev.depositPercent ?? 50 : undefined,
      customText: prev.customText,
    }));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Inserisci un titolo per il preventivo");
      return;
    }
    const emptyItems = normalItems.filter((i) => !i.unitPrice || i.unitPrice <= 0);
    if (emptyItems.length > 0) {
      toast.error("Tutte le righe devono avere un prezzo maggiore di 0");
      return;
    }
    if (setupItem && (!setupItem.unitPrice || setupItem.unitPrice <= 0)) {
      toast.error("Inserisci il prezzo del costo sviluppo e installazione");
      return;
    }
    if (paymentTerms.method === "personalizzato" && !paymentTerms.customText?.trim()) {
      toast.error("Descrivi la modalità di pagamento personalizzata");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        items: items.map((i) => ({
          id: i.id,
          description: i.description,
          details: i.details?.trim() || undefined,
          quantity: i.quantity,
          unitPrice: Math.round(i.unitPrice * 100),
          discount: i.discount,
          billingType: i.billingType,
          isSetup: i.isSetup,
        })),
        notes: notes.trim() || null,
        paymentTerms,
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

  const detailsEditor = (item: QuoteItem) => {
    const busy = !!generating[item.id];
    const hasText = !!item.details?.trim();
    return (
      <div className="space-y-1.5">
        <div className="relative">
          <Textarea
            value={item.details ?? ""}
            onChange={(e) => updateItem(item.id, "details", e.target.value)}
            rows={hasText ? Math.min(8, Math.max(3, (item.details ?? "").split("\n").length + 1)) : 2}
            disabled={busy}
            placeholder={
              item.description.trim().length >= 3
                ? "Descrizione di cosa comprende il servizio: si compila da sola quando esci dal nome"
                : "Scrivi il nome del servizio: la descrizione si genera in automatico"
            }
            className="text-xs leading-relaxed resize-y bg-muted/20"
          />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-md bg-background/70 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sto scrivendo la descrizione…
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs cursor-pointer"
            disabled={busy || item.description.trim().length < 3}
            onClick={() => generateDetails(item, { force: hasText })}
          >
            {hasText ? <RefreshCw className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
            {hasText ? "Rigenera con IA" : "Genera descrizione"}
          </Button>
          {!hasText && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <History className="h-3 w-3" /> riusa quella già scritta per lo stesso servizio
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
                  <SelectValue>
                    {(v: string) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v}
                  </SelectValue>
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

          {/* SETUP OPZIONALE */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="include-setup"
                type="checkbox"
                checked={!!setupItem}
                onChange={(e) => {
                  if (e.target.checked) {
                    setItems((prev) => [
                      { id: crypto.randomUUID(), description: "Sviluppo e installazione", details: "", quantity: 1, unitPrice: 0, discount: 0, billingType: "una_tantum", isSetup: true },
                      ...prev,
                    ]);
                  } else {
                    setItems((prev) => prev.filter((i) => !i.isSetup));
                  }
                }}
                className="accent-primary h-4 w-4"
              />
              <Label htmlFor="include-setup" className="cursor-pointer">Includi costo sviluppo e installazione</Label>
            </div>
            {setupItem && (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div className="col-span-1 font-medium text-muted-foreground">{setupItem.description}</div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Prezzo lordo</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 text-right"
                      value={setupItem.unitPrice || ""}
                      onChange={(e) => updateItem(setupItem.id, "unitPrice", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sconto %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      className="h-8 text-right"
                      value={setupItem.discount || ""}
                      onChange={(e) => updateItem(setupItem.id, "discount", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Prezzo netto</Label>
                    <div className="h-8 flex items-center justify-end font-semibold tabular-nums">
                      €{netPrice(setupItem).toFixed(2)}
                    </div>
                  </div>
                </div>
                {detailsEditor(setupItem)}
              </div>
            )}
          </div>

          {/* VOCI DEL PREVENTIVO */}
          <div className="space-y-2">
            <Label>Voci del preventivo</Label>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="text-left px-3 py-2 font-medium">Servizio</th>
                    <th className="text-left px-3 py-2 font-medium w-28">Tipo</th>
                    <th className="text-right px-3 py-2 font-medium w-16">Qtà</th>
                    <th className="text-right px-3 py-2 font-medium w-28">Lordo (€)</th>
                    <th className="text-right px-3 py-2 font-medium w-20">Sconto %</th>
                    <th className="text-right px-3 py-2 font-medium w-28">Netto (€)</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                {normalItems.map((item) => (
                  <tbody key={item.id} className="border-b last:border-0">
                    <tr className="hover:bg-muted/20">
                      <td className="px-3 pt-1.5">
                        <Input
                          className="h-8 border-0 shadow-none px-0 focus-visible:ring-0 bg-transparent font-medium"
                          value={item.description}
                          onChange={(e) =>
                            updateItem(item.id, "description", e.target.value)
                          }
                          onBlur={() => autoGenerate(item)}
                          placeholder="es. Restyling sito web"
                        />
                      </td>
                      <td className="px-3 pt-1.5">
                        <button
                          type="button"
                          onClick={() => toggleBilling(item.id)}
                          className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer flex items-center gap-1 whitespace-nowrap transition-colors ${
                            item.billingType !== "una_tantum"
                              ? "bg-blue-500/10 border-blue-500/25 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
                              : "bg-muted border-muted-foreground/20 text-muted-foreground"
                          }`}
                          title="Clicca per cambiare tipo"
                        >
                          {item.billingType === "mensile" ? (
                            <><RefreshCw className="h-2.5 w-2.5" /> /mese</>
                          ) : item.billingType === "annuale" ? (
                            <><RefreshCw className="h-2.5 w-2.5" /> /anno</>
                          ) : (
                            <><Minus className="h-2.5 w-2.5" /> Una tantum</>
                          )}
                        </button>
                      </td>
                      <td className="px-3 pt-1.5">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          className="h-8 border-0 shadow-none px-0 focus-visible:ring-0 text-right bg-transparent"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        />
                      </td>
                      <td className="px-3 pt-1.5">
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
                      <td className="px-3 pt-1.5">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          className="h-8 border-0 shadow-none px-0 focus-visible:ring-0 text-right bg-transparent"
                          value={item.discount || ""}
                          onChange={(e) =>
                            updateItem(item.id, "discount", e.target.value)
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 pt-1.5 text-right font-medium tabular-nums">
                        €{netPrice(item).toFixed(2)}
                      </td>
                      <td className="px-1 pt-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                          disabled={normalItems.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="px-3 pb-2.5 pt-1">
                        {detailsEditor(item)}
                      </td>
                    </tr>
                  </tbody>
                ))}
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

            <div className="text-right space-y-1 text-sm min-w-[260px]">
              {setupItem && setupLineTotal > 0 && (
                <div className="flex justify-between gap-8 text-muted-foreground">
                  <span>Sviluppo e installazione</span>
                  <span className="font-medium text-foreground tabular-nums">€{setupLineTotal.toFixed(2)}</span>
                </div>
              )}
              {hasOneTime && (
                <div className="flex justify-between gap-8 text-muted-foreground">
                  <span className="flex items-center gap-1"><Minus className="h-3 w-3" /> Una tantum</span>
                  <span className="font-medium text-foreground tabular-nums">€{oneTimeSub.toFixed(2)}</span>
                </div>
              )}
              {monthlySub > 0 && (
                <div className="flex justify-between gap-8 text-muted-foreground">
                  <span className="flex items-center gap-1 text-blue-600"><RefreshCw className="h-3 w-3" /> Ricorrente/mese</span>
                  <span className="font-medium text-blue-600 tabular-nums">€{monthlySub.toFixed(2)}/mese</span>
                </div>
              )}
              {annualSub > 0 && (
                <div className="flex justify-between gap-8 text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-600"><RefreshCw className="h-3 w-3" /> Ricorrente/anno</span>
                  <span className="font-medium text-emerald-600 tabular-nums">€{annualSub.toFixed(2)}/anno</span>
                </div>
              )}
              <div className="flex justify-between gap-8 text-muted-foreground border-t pt-1">
                <span>Subtotale primo anno</span>
                <span className="font-medium text-foreground tabular-nums">€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-8 text-muted-foreground">
                <span>IVA {vatRate}%</span>
                <span className="font-medium text-foreground tabular-nums">€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-8 font-bold text-base border-t pt-2 mt-1">
                <span>Totale primo anno</span>
                <span className="text-primary tabular-nums">€{total.toFixed(2)}</span>
              </div>
              {(monthlySub > 0 || annualSub > 0) && (
                <div className="flex justify-between gap-8 text-xs text-muted-foreground pt-1">
                  <span>Dal secondo anno</span>
                  <span className="tabular-nums">€{(monthlySub * 12 + annualSub).toFixed(2)}/anno</span>
                </div>
              )}
            </div>
          </div>

          {/* MODALITÀ DI PAGAMENTO */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2 min-w-[240px] flex-1">
                <Label>Modalità di pagamento</Label>
                <Select value={paymentTerms.method} onValueChange={(v) => v && setMethod(v as PaymentMethod)}>
                  <SelectTrigger className="cursor-pointer w-full">
                    <SelectValue>
                      {(v: string) => PAYMENT_METHODS.find((m) => m.value === v)?.label ?? v}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {paymentTerms.method === "rate" && (
                <div className="space-y-2">
                  <Label>Numero rate</Label>
                  <Select
                    value={String(paymentTerms.installments ?? 3)}
                    onValueChange={(v) => v && setPaymentTerms((p) => ({ ...p, installments: Number(v) }))}
                  >
                    <SelectTrigger className="cursor-pointer w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTALLMENT_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} rate
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {paymentTerms.method === "acconto_saldo" && (
                <div className="space-y-2">
                  <Label>Acconto</Label>
                  <Select
                    value={String(paymentTerms.depositPercent ?? 50)}
                    onValueChange={(v) => v && setPaymentTerms((p) => ({ ...p, depositPercent: Number(v) }))}
                  >
                    <SelectTrigger className="cursor-pointer w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPOSIT_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {paymentTerms.method === "personalizzato" ? (
              <Textarea
                value={paymentTerms.customText ?? ""}
                onChange={(e) => setPaymentTerms((p) => ({ ...p, customText: e.target.value }))}
                rows={2}
                placeholder="es. 40% alla firma, 40% alla presentazione della grafica, 20% alla messa online"
              />
            ) : (
              <p className="text-xs text-muted-foreground">{describePaymentTerms(paymentTerms)}</p>
            )}

            {schedule.length > 0 && (
              <div className="rounded-md bg-muted/30 px-3 py-2 text-sm">
                {schedule.map((row) => (
                  <div key={row.label} className="flex justify-between gap-6 py-0.5">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium tabular-nums">{eur(row.amount / 100)}</span>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Importi IVA inclusa, calcolati sulla parte una tantum
                  {monthlySub > 0 || annualSub > 0 ? "; i canoni ricorrenti si pagano alla loro scadenza." : "."}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-notes">Note</Label>
            <Textarea
              id="q-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Termini di consegna, validità offerta, altre condizioni..."
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
