"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PROJECT_STATUS_OPTIONS, PROJECT_STATUS_CONFIG } from "./projectConstants";
import { UserMultiSelect } from "./UserMultiSelect";
import type { Project } from "@/types";

const schema = z.object({
  title: z.string().min(1, "Titolo obbligatorio"),
  description: z.string().optional(),
  status: z.enum(["aperto", "in_lavorazione", "bloccato", "in_pausa", "revisione_cto", "consegnato"]),
  priority: z.enum(["bassa", "media", "alta"]),
  assignedTo: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function toDateInput(val: Date | null | undefined): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  initialData?: Project;
}

export function ProjectForm({ open, onClose, initialData }: ProjectFormProps) {
  const isEdit = !!initialData;
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([]);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      status: "aperto",
      priority: "media",
      assignedTo: [],
      startDate: "",
      dueDate: "",
      notes: "",
      contactId: "",
      dealId: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    fetch("/api/contacts").then((r) => r.json()).then(setContacts).catch(() => {});
    if (isEdit && initialData) {
      reset({
        title: initialData.title,
        description: initialData.description ?? "",
        status: initialData.status,
        priority: initialData.priority,
        assignedTo: initialData.assignedTo ?? [],
        startDate: toDateInput(initialData.startDate),
        dueDate: toDateInput(initialData.dueDate),
        notes: initialData.notes ?? "",
        contactId: initialData.contactId ?? "",
        dealId: initialData.dealId ?? "",
      });
    } else {
      reset({ title: "", description: "", status: "aperto", priority: "media", assignedTo: [], startDate: "", dueDate: "", notes: "", contactId: "", dealId: "" });
    }
  }, [open, isEdit, initialData, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        description: data.description || null,
        assignedTo: data.assignedTo ?? [],
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
        notes: data.notes || null,
        contactId: data.contactId || null,
        dealId: data.dealId || null,
      };
      const res = isEdit
        ? await fetch(`/api/projects/${initialData!.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      toast.success(isEdit ? "Progetto aggiornato" : "Progetto creato");
      onClose();
    } catch {
      toast.error("Errore durante il salvataggio");
    }
  };

  const status = watch("status");
  const priority = watch("priority");
  const contactId = watch("contactId");
  const assignedTo = watch("assignedTo") ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica Progetto" : "Nuovo Progetto"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Titolo *</Label>
            <Input {...register("title")} placeholder="es. Sito web cliente XYZ" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Descrizione</Label>
            <Textarea {...register("description")} rows={2} placeholder="Breve descrizione del progetto..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select value={status} onValueChange={(v) => setValue("status", v as FormData["status"])}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{PROJECT_STATUS_CONFIG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorità</Label>
              <Select value={priority} onValueChange={(v) => setValue("priority", v as FormData["priority"])}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bassa">Bassa</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assegnato a</Label>
            <UserMultiSelect
              value={assignedTo}
              onChange={(v) => setValue("assignedTo", v)}
              placeholder="Seleziona membri del team"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data inizio</Label>
              <Input type="date" {...register("startDate")} />
            </div>
            <div className="space-y-2">
              <Label>Scadenza</Label>
              <Input type="date" {...register("dueDate")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cliente collegato</Label>
            <Select value={contactId || "__none__"} onValueChange={(v) => setValue("contactId", v === "__none__" || !v ? "" : v)}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Nessun cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nessun cliente</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Note interne</Label>
            <Textarea {...register("notes")} rows={3} placeholder="Note tecniche, specifiche, riferimenti..." />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">Annulla</Button>
            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
              {isSubmitting ? "Salvataggio..." : isEdit ? "Salva modifiche" : "Crea progetto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
