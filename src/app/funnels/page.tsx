"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, GitBranch, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { parseFunnelSteps } from "@/lib/capture/funnels";
import type { Funnel } from "@/lib/capture/types";

const STATUS_LABELS = { draft: "Bozza", active: "Attivo", archived: "Archiviato" };
const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};

export default function FunnelsPage() {
  const router = useRouter();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Funnel | null>(null);

  const load = () => {
    fetch("/api/funnels")
      .then((res) => res.json())
      .then((data) => setFunnels(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error();
      const funnel = await res.json();
      router.push(`/funnels/${funnel.id}`);
    } catch {
      toast.error("Errore nella creazione");
      setBusy(false);
    }
  };

  const duplicate = async (funnel: Funnel) => {
    const res = await fetch(`/api/funnels/${funnel.id}/duplicate`, { method: "POST" });
    if (res.ok) {
      toast.success("Funnel duplicato");
      load();
    } else toast.error("Errore nella duplicazione");
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const res = await fetch(`/api/funnels/${deleting.id}`, { method: "DELETE" });
    if (res.ok) {
      setFunnels((prev) => prev.filter((item) => item.id !== deleting.id));
      toast.success("Funnel eliminato");
    } else toast.error("Errore nell'eliminazione");
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Funnel</h1>
          <p className="text-xs text-muted-foreground">Crea sequenze di conversione tracciate</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Nuovo funnel</Button>
      </div>

      {loading ? (
        <div className="h-24 animate-pulse rounded-md bg-muted" />
      ) : funnels.length === 0 ? (
        <EmptyState icon={GitBranch} title="Nessun funnel" description="Crea il tuo primo percorso di conversione." actionLabel="Nuovo funnel" onAction={() => setCreating(true)} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Stato</TableHead><TableHead>Step</TableHead><TableHead>Conversioni</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {funnels.map((funnel) => (
                <TableRow key={funnel.id}>
                  <TableCell><button className="font-medium hover:underline" onClick={() => router.push(`/funnels/${funnel.id}`)}>{funnel.name}</button><p className="text-xs text-muted-foreground">/f/{funnel.slug}</p></TableCell>
                  <TableCell><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[funnel.status])}>{STATUS_LABELS[funnel.status]}</span></TableCell>
                  <TableCell>{parseFunnelSteps(funnel.steps).length}</TableCell>
                  <TableCell>{funnel.conversions}</TableCell>
                  <TableCell><div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/funnels/${funnel.id}`)}><Pencil className="h-4 w-4" /></Button>
                    {funnel.status === "active" && <a href={`/f/${funnel.slug}`} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button></a>}
                    <Button variant="ghost" size="icon" onClick={() => duplicate(funnel)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(funnel)}><Trash2 className="h-4 w-4" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Nuovo funnel</DialogTitle></DialogHeader>
          <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Es. Consulenza commerciale" />
          <Button onClick={create} disabled={!newName.trim() || busy}>{busy ? "Creazioneâ€¦" : "Crea"}</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Eliminare il funnel?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">L&apos;azione Ã¨ irreversibile.</p>
          <Button variant="destructive" onClick={confirmDelete}>Elimina</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
