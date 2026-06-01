"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, FileInput, ExternalLink, Copy, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/constants";
import type { CrmForm } from "@/lib/capture/types";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  active: "Attivo",
  archived: "Archiviato",
};

export default function FormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<CrmForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<CrmForm | null>(null);

  const load = () => {
    fetch("/api/forms")
      .then((res) => res.json())
      .then((data) => {
        setForms(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error();
      const form = await res.json();
      toast.success("Form creato");
      router.push(`/forms/${form.id}`);
    } catch {
      toast.error("Errore nella creazione");
      setBusy(false);
    }
  };

  const duplicate = async (form: CrmForm) => {
    try {
      const res = await fetch(`/api/forms/${form.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Form duplicato");
      load();
    } catch {
      toast.error("Errore nella duplicazione");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/forms/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setForms((prev) => prev.filter((f) => f.id !== deleting.id));
      toast.success("Form eliminato");
    } catch {
      toast.error("Errore nell'eliminazione");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Form</h1>
          <p className="text-xs text-muted-foreground">
            Crea form da incorporare per catturare lead
          </p>
        </div>
        <Button onClick={() => { setNewName(""); setCreating(true); }} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Nuovo form
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />)}
        </div>
      ) : forms.length === 0 ? (
        <EmptyState
          icon={FileInput}
          title="Nessun form"
          description="Crea il tuo primo form per iniziare a catturare lead."
          actionLabel="Nuovo form"
          onAction={() => { setNewName(""); setCreating(true); }}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Stato</TableHead>
                <TableHead className="hidden lg:table-cell">Visite</TableHead>
                <TableHead className="hidden lg:table-cell">Invii</TableHead>
                <TableHead className="hidden md:table-cell">Creato</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form) => (
                <TableRow key={form.id}>
                  <TableCell>
                    <button
                      onClick={() => router.push(`/forms/${form.id}`)}
                      className="font-medium hover:underline cursor-pointer text-left"
                    >
                      {form.name}
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[form.status])}>
                      {STATUS_LABELS[form.status]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{form.views}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{form.submissions}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(form.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => router.push(`/forms/${form.id}`)} title="Modifica">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {form.status === "active" && (
                        <a href={`/form/${form.id}`} target="_blank" rel="noopener noreferrer" title="Apri">
                          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => duplicate(form)} title="Duplica">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => setDeleting(form)} title="Elimina">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={creating} onOpenChange={(v) => !v && setCreating(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nuovo form</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                placeholder="Es. Contattaci"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="cursor-pointer" onClick={() => setCreating(false)}>Annulla</Button>
              <Button className="cursor-pointer" onClick={create} disabled={!newName.trim() || busy}>
                {busy ? "Creazione…" : "Crea"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Eliminare il form?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per eliminare <strong>{deleting?.name}</strong>. Questa azione è irreversibile.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => setDeleting(null)}>Annulla</Button>
            <Button variant="destructive" className="cursor-pointer" onClick={confirmDelete}>Elimina</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
