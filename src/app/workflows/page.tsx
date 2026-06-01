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
import { Plus, Workflow as WorkflowIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflows/types";
import type { Workflow } from "@/lib/workflows/types";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  archived: "bg-gray-100 text-gray-600",
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Workflow | null>(null);

  const load = () => {
    fetch("/api/workflows")
      .then((res) => res.json())
      .then((data) => {
        setWorkflows(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error();
      const workflow = await res.json();
      toast.success("Workflow creato");
      router.push(`/workflows/${workflow.id}`);
    } catch {
      toast.error("Errore nella creazione");
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/workflows/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setWorkflows((prev) => prev.filter((w) => w.id !== deleting.id));
      toast.success("Workflow eliminato");
    } catch {
      toast.error("Errore nell'eliminazione");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Workflow</h1>
          <p className="text-xs text-muted-foreground">
            Automazioni visive per il tuo CRM
          </p>
        </div>
        <Button onClick={() => { setNewName(""); setCreating(true); }} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Nuovo workflow
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />)}
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="Nessun workflow"
          description="Crea il tuo primo workflow per automatizzare il CRM."
          actionLabel="Nuovo workflow"
          onAction={() => { setNewName(""); setCreating(true); }}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Stato</TableHead>
                <TableHead className="hidden md:table-cell">Trigger</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell>
                    <button
                      onClick={() => router.push(`/workflows/${workflow.id}`)}
                      className="font-medium hover:underline cursor-pointer text-left"
                    >
                      {workflow.name}
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[workflow.status])}>
                      {WORKFLOW_STATUS_LABELS[workflow.status]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{workflow.triggerType}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => router.push(`/workflows/${workflow.id}`)} title="Modifica">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => setDeleting(workflow)} title="Elimina">
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
          <DialogHeader><DialogTitle>Nuovo workflow</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                placeholder="Es. Benvenuto nuovo lead"
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
          <DialogHeader><DialogTitle>Eliminare il workflow?</DialogTitle></DialogHeader>
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
