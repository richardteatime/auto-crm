"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Paperclip } from "lucide-react";
import { toast } from "sonner";

interface Attachment {
  name: string;
  url: string;
}

export interface OpportunityFormData {
  id?: string;
  title: string;
  description: string;
  notes: string;
  value: string;
  attachments: Attachment[];
}

interface OpportunityFormProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  initialData?: OpportunityFormData;
}

export function OpportunityForm({ open, onClose, contactId, initialData }: OpportunityFormProps) {
  const isEditing = !!initialData?.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description);
      setNotes(initialData.notes);
      setValue(initialData.value);
      setAttachments(initialData.attachments);
    } else {
      setTitle("");
      setDescription("");
      setNotes("");
      setValue("");
      setAttachments([]);
    }
  }, [open, initialData]);

  const addAttachment = () => {
    setAttachments((prev) => [...prev, { name: "", url: "" }]);
  };

  const updateAttachment = (idx: number, field: keyof Attachment, val: string) => {
    setAttachments((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Il titolo è obbligatorio");
      return;
    }
    setSubmitting(true);
    try {
      const validAttachments = attachments.filter((a) => a.name.trim() && a.url.trim());
      const payload = {
        contactId,
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        attachments: validAttachments.length > 0 ? JSON.stringify(validAttachments) : null,
        value: value ? parseFloat(value) : null,
      };

      const url = isEditing ? `/api/opportunities/${initialData!.id}` : "/api/opportunities";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore nel salvataggio");
      }
      toast.success(isEditing ? "Opportunità aggiornata" : "Opportunità creata");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nel salvataggio");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifica Opportunità" : "Nuova Opportunità"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="opp-title">Titolo *</Label>
            <Input
              id="opp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="es. Progetto sito web, Consulenza mensile..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="opp-value">Valore stimato (€)</Label>
            <Input
              id="opp-value"
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="opp-desc">Descrizione</Label>
            <Textarea
              id="opp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descrivi l'opportunità, il contesto, l'interesse del cliente..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="opp-notes">Note interne</Label>
            <Textarea
              id="opp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Note private, prossimi passi, obiezioni..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Allegati (link)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cursor-pointer gap-1 h-7 text-xs"
                onClick={addAttachment}
              >
                <Plus className="h-3 w-3" />
                Aggiungi
              </Button>
            </div>
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((a, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={a.name}
                      onChange={(e) => updateAttachment(idx, "name", e.target.value)}
                      placeholder="Nome file"
                      className="flex-1"
                    />
                    <Input
                      value={a.url}
                      onChange={(e) => updateAttachment(idx, "url", e.target.value)}
                      placeholder="URL / link"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="cursor-pointer h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAttachment(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {attachments.length === 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                Nessun allegato. Aggiungi link a documenti Drive, Dropbox, ecc.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Annulla
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting} className="cursor-pointer">
              {submitting ? "Salvataggio..." : isEditing ? "Salva modifiche" : "Crea opportunità"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
