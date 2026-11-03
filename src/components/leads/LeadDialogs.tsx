"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LOST_REASONS, type Lead } from "@/lib/leads/types";

const EMPTY = { name: "", phone: "", email: "", company: "", service: "", notes: "" };

/** Create a lead by hand, or edit the contact fields of an existing one */
export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead?: Lead | null;
  onSaved?: (lead: Lead) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const editing = !!lead;

  useEffect(() => {
    if (!open) return;
    setForm(
      lead
        ? { name: lead.name, phone: lead.phone ?? "", email: lead.email ?? "", company: lead.company ?? "", service: lead.service ?? "", notes: "" }
        : EMPTY
    );
  }, [open, lead]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Il nome è obbligatorio");
    if (!form.phone.trim() && !form.email.trim()) return toast.error("Serve almeno telefono o email");
    setSaving(true);
    try {
      const { notes, ...fields } = form;
      const res = await fetch(editing ? `/api/leads/${lead!.id}` : "/api/leads", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? fields : { ...fields, notes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Errore");
      toast.success(editing ? "Lead aggiornato" : "Lead creato");
      onOpenChange(false);
      onSaved?.(data as Lead);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifica dati del lead" : "Nuovo lead"}</DialogTitle>
          {!editing && <DialogDescription>Per i contatti arrivati al telefono, da passaparola o di persona.</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="lf-name">Nome e cognome *</Label>
            <Input id="lf-name" value={form.name} onChange={set("name")} autoFocus={!editing} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lf-phone">Telefono</Label>
              <Input id="lf-phone" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="+39 333 123 4567" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-email">Email</Label>
              <Input id="lf-email" type="email" value={form.email} onChange={set("email")} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lf-company">Azienda</Label>
              <Input id="lf-company" value={form.company} onChange={set("company")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-service">Interesse</Label>
              <Input id="lf-service" value={form.service} onChange={set("service")} placeholder="Sito, e-commerce, gestionale…" />
            </div>
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <Label htmlFor="lf-notes">Note</Label>
              <Textarea id="lf-notes" rows={3} value={form.notes} onChange={set("notes")} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {editing ? "Salva" : "Crea lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Asked when a lead is dragged to "Perso" */
export function LostReasonDialog({
  open,
  leadName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  leadName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const close = (fn: () => void) => {
    setReason(LOST_REASONS[0]);
    fn();
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close(onCancel)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Perché è perso?</DialogTitle>
          <DialogDescription>{leadName}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {LOST_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "h-8 rounded-md border bg-card px-2.5 text-xs font-medium transition-colors hover:bg-muted",
                reason === r && "border-primary bg-primary/[0.06] text-primary"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => close(onCancel)}>
            Annulla
          </Button>
          <Button onClick={() => close(() => onConfirm(reason))}>Segna come perso</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
