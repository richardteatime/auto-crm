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
import { Paperclip, X, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const dealSchema = z.object({
  title: z.string().min(1, "Il titolo è obbligatorio"),
  value: z.string(),
  contactId: z.string().min(1, "Il contatto è obbligatorio"),
  stageId: z.string(),
  probability: z.string(),
  expectedClose: z.string(),
  notes: z.string(),
});

type DealFormData = z.infer<typeof dealSchema>;

interface Attachment { name: string; url: string }

export interface DealInitialData {
  id: string;
  title: string;
  value: number;
  contactId: string;
  stageId: string;
  probability: number;
  expectedClose?: number | Date | null;
  notes?: string | null;
  attachments?: string | null;
  isRecurring?: boolean;
  recurringMonths?: number | null;
  isPaid?: boolean;
}

interface DealFormProps {
  open: boolean;
  onClose: () => void;
  initialData?: DealInitialData;
  preselectedContactId?: string;
}

function toDateInputValue(val: number | Date | null | undefined): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(typeof val === "number" && val < 1e12 ? val * 1000 : val);
  return d.toISOString().split("T")[0];
}

export function DealForm({ open, onClose, initialData, preselectedContactId }: DealFormProps) {
  const router = useRouter();
  const isEditing = !!initialData?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contactsList, setContacts] = useState<Array<{ id: string; name: string }>>([]);
  const [stagesList, setStages] = useState<Array<{ id: string; name: string }>>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState(12);
  const [isPaid, setIsPaid] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: "", value: "", contactId: "", stageId: "",
      probability: "50", expectedClose: "", notes: "",
    },
  });

  // Single async effect: load data first, THEN set form values — fixes UUID display bug
  useEffect(() => {
    if (!open) return;

    const init = async () => {
      const [stages, contacts] = await Promise.all([
        fetch("/api/pipeline").then((r) => r.json()),
        preselectedContactId ? Promise.resolve([]) : fetch("/api/contacts").then((r) => r.json()),
      ]);

      setStages(stages);
      if (!preselectedContactId) setContacts(contacts);

      if (initialData) {
        let parsedAttachments: Attachment[] = [];
        try { parsedAttachments = JSON.parse(initialData.attachments || "[]"); } catch { /* */ }
        setAttachments(parsedAttachments);
        setIsRecurring(initialData.isRecurring ?? false);
        setRecurringMonths(initialData.recurringMonths ?? 12);
        setIsPaid(initialData.isPaid ?? false);

        reset({
          title: initialData.title,
          value: (initialData.value / 100).toFixed(2),
          contactId: initialData.contactId,
          stageId: initialData.stageId,
          probability: String(initialData.probability),
          expectedClose: toDateInputValue(initialData.expectedClose),
          notes: initialData.notes ?? "",
        });
      } else {
        setAttachments([]);
        setIsRecurring(false);
        setRecurringMonths(12);
        setIsPaid(false);
        reset({
          title: "", value: "",
          contactId: preselectedContactId || "",
          stageId: stages[0]?.id || "",
          probability: "50", expectedClose: "", notes: "",
        });
      }
    };

    init();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
      toast.error(err instanceof Error ? err.message : "Errore upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: DealFormData) => {
    const payload = {
      ...data,
      value: Math.round(parseFloat(data.value || "0") * 100),
      probability: parseInt(data.probability || "0"),
      attachments,
      isRecurring,
      recurringMonths: isRecurring ? recurringMonths : null,
      isPaid,
    };

    try {
      const res = await fetch(
        isEditing ? `/api/deals/${initialData!.id}` : "/api/deals",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error();
      toast.success(isEditing ? "Trattativa aggiornata" : "Trattativa creata con successo");
      if (!isEditing) reset();
      onClose();
      router.refresh();
    } catch {
      toast.error(isEditing ? "Errore durante l'aggiornamento" : "Errore durante la creazione");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifica Trattativa" : "Nuova Trattativa"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deal-title">Titolo *</Label>
            <Input id="deal-title" {...register("title")} placeholder="Servizio Premium - Azienda X" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="deal-value">Valore (EUR)</Label>
              <Input id="deal-value" type="number" step="0.01" {...register("value")} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Probabilità (%)</Label>
              <Input type="number" min="0" max="100" {...register("probability")} />
            </div>
          </div>

          {!preselectedContactId && (
            <div className="space-y-2">
              <Label>Contatto *</Label>
              <Select value={watch("contactId")} onValueChange={(v) => v && setValue("contactId", v)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Seleziona contatto" />
                </SelectTrigger>
                <SelectContent>
                  {contactsList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contactId && <p className="text-xs text-destructive">{errors.contactId.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fase</Label>
              <Select value={watch("stageId")} onValueChange={(v) => v && setValue("stageId", v)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Prima fase" />
                </SelectTrigger>
                <SelectContent>
                  {stagesList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chiusura stimata</Label>
              <Input type="date" {...register("expectedClose")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal-notes">Note</Label>
            <Textarea id="deal-notes" {...register("notes")} rows={2} />
          </div>

          {/* Tipo contratto */}
          <div className="space-y-2">
            <Label>Tipo Contratto</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsRecurring(false)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer",
                  !isRecurring
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                Una Tantum
              </button>
              <button
                type="button"
                onClick={() => setIsRecurring(true)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer",
                  isRecurring
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Ricorrente / Mese
              </button>
            </div>
          </div>

          {isRecurring && (
            <div className="space-y-2">
              <Label>Durata Contratto</Label>
              <Select value={String(recurringMonths)} onValueChange={(v) => setRecurringMonths(Number(v))}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mese</SelectItem>
                  <SelectItem value="3">3 mesi</SelectItem>
                  <SelectItem value="6">6 mesi</SelectItem>
                  <SelectItem value="12">12 mesi (1 anno)</SelectItem>
                  <SelectItem value="24">24 mesi (2 anni)</SelectItem>
                  <SelectItem value="36">36 mesi (3 anni)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Valore mensile: {isNaN(parseFloat(watch("value") || "0")) ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(parseFloat(watch("value") || "0"))} × {recurringMonths} = {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(parseFloat(watch("value") || "0") * recurringMonths)} totale
              </p>
            </div>
          )}

          {/* Pagamento */}
          <div className="space-y-2">
            <Label>Stato Pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPaid(false)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer",
                  !isPaid
                    ? "bg-amber-500 text-white border-amber-500"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                Non Pagato
              </button>
              <button
                type="button"
                onClick={() => setIsPaid(true)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer",
                  isPaid
                    ? "bg-green-600 text-white border-green-600"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                Pagato
              </button>
            </div>
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
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                {uploading ? "Caricamento..." : "Allega file"}
              </Button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
            </div>
            {attachments.length > 0 && (
              <ul className="space-y-1">
                {attachments.map((a) => (
                  <li key={a.url} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 truncate hover:underline text-primary">{a.name}</a>
                    <button type="button" onClick={() => setAttachments((p) => p.filter((x) => x.url !== a.url))}
                      className="cursor-pointer p-0.5 rounded hover:bg-muted">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">Annulla</Button>
            <Button type="submit" disabled={isSubmitting || uploading} className="cursor-pointer">
              {isSubmitting ? (isEditing ? "Salvataggio..." : "Creazione...") : (isEditing ? "Salva modifiche" : "Crea Trattativa")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
