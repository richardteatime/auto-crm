"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Paperclip, X, Loader2 } from "lucide-react";

const schema = z.object({
  type: z.enum(["call", "email", "meeting", "note", "follow_up"]),
  description: z.string().min(1, "L'oggetto è obbligatorio"),
  contactId: z.string().min(1, "Il contatto è obbligatorio"),
  dealId: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Attachment {
  name: string;
  url: string;
}

interface ActivityFormProps {
  open: boolean;
  onClose: () => void;
  preselectedContactId?: string;
  preselectedDealId?: string;
}

export function ActivityForm({
  open,
  onClose,
  preselectedContactId,
  preselectedDealId,
}: ActivityFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contactsList, setContacts] = useState<Array<{ id: string; name: string }>>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "note",
      description: "",
      contactId: preselectedContactId || "",
      dealId: preselectedDealId || "",
      startAt: "",
      endAt: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setAttachments([]);
    reset({
      type: "note",
      description: "",
      contactId: preselectedContactId || "",
      dealId: preselectedDealId || "",
      startAt: "",
      endAt: "",
      notes: "",
    });
    if (!preselectedContactId) {
      fetch("/api/contacts")
        .then((r) => r.json())
        .then(setContacts);
    }
  }, [open, preselectedContactId, preselectedDealId, reset]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const results = await Promise.all(
        files.map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/uploads", { method: "POST", body: fd });
          if (!res.ok) throw new Error(`Upload fallito: ${file.name}`);
          return res.json() as Promise<Attachment>;
        })
      );
      setAttachments((prev) => [...prev, ...results]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore durante l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  };

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: data.type,
          description: data.description,
          contactId: data.contactId,
          dealId: data.dealId || null,
          startAt: data.startAt || null,
          endAt: data.endAt || null,
          notes: data.notes || null,
          attachments,
        }),
      });

      if (!res.ok) throw new Error();
      toast.success("Attività registrata");
      onClose();
      router.refresh();
    } catch {
      toast.error("Errore durante la registrazione dell'attività");
    }
  };

  const type = watch("type");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registra Attività</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select
              value={type}
              onValueChange={(v) => v && setValue("type", v as FormData["type"])}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Chiamata</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Riunione</SelectItem>
                <SelectItem value="note">Nota</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Oggetto */}
          <div className="space-y-2">
            <Label htmlFor="act-desc">Oggetto *</Label>
            <Input
              id="act-desc"
              {...register("description")}
              placeholder={
                type === "call" ? "es. Chiamata di presentazione" :
                type === "email" ? "es. Email offerta commerciale" :
                type === "meeting" ? "es. Riunione di chiusura" :
                type === "follow_up" ? "es. Follow-up preventivo inviato" :
                "es. Nota di aggiornamento"
              }
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Date inizio / fine */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="act-start">
                {type === "follow_up" ? "Data programmata" : "Data inizio"}
              </Label>
              <Input
                id="act-start"
                type="datetime-local"
                {...register("startAt")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-end">Data fine</Label>
              <Input
                id="act-end"
                type="datetime-local"
                {...register("endAt")}
              />
            </div>
          </div>

          {/* Contatto (solo se non preselezionato) */}
          {!preselectedContactId && (
            <div className="space-y-2">
              <Label>Contatto *</Label>
              <Select
                value={watch("contactId")}
                onValueChange={(v) => v && setValue("contactId", v)}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Seleziona contatto" />
                </SelectTrigger>
                <SelectContent>
                  {contactsList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contactId && (
                <p className="text-xs text-destructive">{errors.contactId.message}</p>
              )}
            </div>
          )}

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="act-notes">Note</Label>
            <Textarea
              id="act-notes"
              {...register("notes")}
              rows={3}
              placeholder="Dettagli, osservazioni, punti discussi..."
            />
          </div>

          {/* Allegati */}
          <div className="space-y-2">
            <Label>Allegati</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" />
                )}
                {uploading ? "Caricamento..." : "Allega file"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {attachments.length > 0 && (
              <ul className="space-y-1">
                {attachments.map((a) => (
                  <li
                    key={a.url}
                    className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1"
                  >
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate hover:underline text-primary"
                    >
                      {a.name}
                    </a>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.url)}
                      className="cursor-pointer p-0.5 rounded hover:bg-muted"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Annulla
            </Button>
            <Button type="submit" disabled={isSubmitting || uploading} className="cursor-pointer">
              {isSubmitting ? "Salvataggio..." : "Registra"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
