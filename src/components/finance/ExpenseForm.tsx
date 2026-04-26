"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Expense } from "@/types";

const CATEGORIES = [
  "Marketing",
  "Licenze Software",
  "Stipendi",
  "Forniture",
  "Viaggi",
  "Consulenze",
  "Infrastruttura",
  "Investimenti",
  "Altro",
];

const EXPENSE_TYPES = [
  { value: "spesa", label: "Spesa" },
  { value: "investimento", label: "Investimento" },
  { value: "stipendio", label: "Stipendio" },
];

const schema = z.object({
  type: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1, "La descrizione è obbligatoria"),
  amount: z.string().min(1, "L'importo è obbligatorio"),
  date: z.string().min(1, "La data è obbligatoria"),
  createdBy: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

interface ExpenseFormProps {
  open: boolean;
  onClose: () => void;
  initialData?: Expense;
  onSaved: () => void;
}

function toDateInput(val: Date | number | null | undefined): string {
  if (!val) return new Date().toISOString().split("T")[0];
  const d = val instanceof Date ? val : new Date(typeof val === "number" && val < 1e12 ? val * 1000 : val);
  return d.toISOString().split("T")[0];
}

export function ExpenseForm({ open, onClose, initialData, onSaved }: ExpenseFormProps) {
  const isEditing = !!initialData?.id;
  const [category, setCategory] = useState("Altro");
  const [type, setType] = useState("spesa");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "spesa", category: "Altro", description: "", amount: "", date: "", createdBy: "Team" },
  });

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setType(initialData.type);
      setCategory(initialData.category);
      reset({
        type: initialData.type,
        category: initialData.category,
        description: initialData.description,
        amount: (initialData.amount / 100).toFixed(2),
        date: toDateInput(initialData.date),
        createdBy: initialData.createdBy,
      });
    } else {
      setType("spesa");
      setCategory("Altro");
      reset({
        type: "spesa",
        category: "Altro",
        description: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        createdBy: "Team",
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: FormData) => {
    const payload = { ...data, type, category };
    try {
      const res = await fetch(
        isEditing ? `/api/expenses/${initialData!.id}` : "/api/expenses",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error();
      toast.success(isEditing ? "Spesa aggiornata" : "Spesa aggiunta");
      onSaved();
      onClose();
    } catch {
      toast.error("Errore durante il salvataggio");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifica Spesa" : "Aggiungi Spesa / Investimento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => v != null && setType(v)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => v != null && setCategory(v)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrizione *</Label>
            <Textarea {...register("description")} rows={2} placeholder="Descrizione della spesa..." />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Importo (EUR) *</Label>
              <Input type="number" step="0.01" min="0" {...register("amount")} placeholder="0.00" />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" {...register("date")} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Inserito da</Label>
            <Input {...register("createdBy")} placeholder="Nome o team" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">Annulla</Button>
            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
              {isSubmitting ? "Salvataggio..." : isEditing ? "Salva" : "Aggiungi"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
