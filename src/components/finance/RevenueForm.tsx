"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserMultiSelect } from "@/components/timeline/UserMultiSelect";
import type { Revenue } from "@/types";

interface RevenueFormProps {
  open: boolean;
  onClose: () => void;
  initialData?: Revenue;
  onSaved?: () => void;
}

function toDateInput(val: Date | null | undefined): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function RevenueForm({ open, onClose, initialData, onSaved }: RevenueFormProps) {
  const isEdit = !!initialData;
  const [description, setDescription] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [recurringMonths, setRecurringMonths] = useState("12");
  const [startDate, setStartDate] = useState("");
  const [collectedBy, setCollectedBy] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isExternal, setIsExternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (isEdit && initialData) {
      setDescription(initialData.description);
      setIsRecurring(initialData.isRecurring);
      setAmount((initialData.amount / 100).toFixed(2));
      setDate(toDateInput(initialData.date));
      setRecurringMonths(String(initialData.recurringMonths ?? 12));
      setStartDate(toDateInput(initialData.startDate));
      setCollectedBy(initialData.collectedBy ?? []);
      setNotes(initialData.notes ?? "");
      setIsExternal(initialData.isExternal);
    } else {
      setDescription("");
      setIsRecurring(false);
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      setRecurringMonths("12");
      setStartDate("");
      setCollectedBy([]);
      setNotes("");
      setIsExternal(false);
    }
    setErrors({});
  }, [open, isEdit, initialData]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!description.trim()) e.description = "Descrizione obbligatoria";
    const n = Number(amount);
    if (isNaN(n) || n <= 0) e.amount = "Importo minimo 0.01";
    if (!date) e.date = "Data obbligatoria";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        description: description.trim(),
        amount: Math.round(Number(amount) * 100),
        date,
        isRecurring,
        recurringMonths: isRecurring ? Number(recurringMonths || 12) : null,
        startDate: isRecurring ? (startDate || date) : null,
        collectedBy,
        notes: notes.trim() || null,
        isExternal,
      };
      const res = isEdit
        ? await fetch(`/api/revenues/${initialData!.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/revenues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      toast.success(isEdit ? "Incasso aggiornato" : "Incasso registrato");
      onSaved?.();
      onClose();
    } catch {
      toast.error("Errore durante il salvataggio");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica Incasso" : "Nuovo Incasso"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Descrizione *</Label>
            <Textarea rows={2} placeholder="es. Consulenza mensile cliente XYZ" value={description} onChange={(e) => setDescription(e.target.value)} />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label>Tipo incasso *</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="tipo" className="accent-primary" checked={!isRecurring} onChange={() => setIsRecurring(false)} />
                Una tantum
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="tipo" className="accent-primary" checked={isRecurring} onChange={() => setIsRecurring(true)} />
                Ricorrente
              </label>
            </div>
          </div>

          {isRecurring && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mesi ricorrenza</Label>
                <Input type="number" min={1} max={120} value={recurringMonths} onChange={(e) => setRecurringMonths(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data inizio</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valore (€) *</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="space-y-2">
              <Label>Data incasso *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chi ha incassato</Label>
            <UserMultiSelect
              value={collectedBy}
              onChange={setCollectedBy}
              placeholder="Seleziona chi ha incassato"
            />
          </div>

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea rows={2} placeholder="Note aggiuntive..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Collaborazione esterna</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="esterno" className="accent-primary" checked={!isExternal} onChange={() => setIsExternal(false)} />
                No
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="esterno" className="accent-primary" checked={isExternal} onChange={() => setIsExternal(true)} />
                Sì
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">Annulla</Button>
            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
              {isSubmitting ? "Salvataggio..." : isEdit ? "Salva modifiche" : "Registra incasso"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
