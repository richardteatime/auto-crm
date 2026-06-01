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
import { Plus, CalendarClock, ExternalLink, Copy, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/constants";
import type { BookingLink } from "@/lib/capture/types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  archived: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Attivo",
  paused: "In pausa",
  archived: "Archiviato",
};

export default function BookingLinksPage() {
  const router = useRouter();
  const [links, setLinks] = useState<BookingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<BookingLink | null>(null);

  const load = () => {
    fetch("/api/booking-links")
      .then((res) => res.json())
      .then((data) => {
        setLinks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/booking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error();
      const link = await res.json();
      toast.success("Link di prenotazione creato");
      router.push(`/booking-links/${link.id}`);
    } catch {
      toast.error("Errore nella creazione");
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/booking-links/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setLinks((prev) => prev.filter((l) => l.id !== deleting.id));
      toast.success("Link eliminato");
    } catch {
      toast.error("Errore nell'eliminazione");
    } finally {
      setDeleting(null);
    }
  };

  const duplicate = async (link: BookingLink) => {
    try {
      const res = await fetch(`/api/booking-links/${link.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Link duplicato");
      load();
    } catch {
      toast.error("Errore nella duplicazione");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Prenotazioni</h1>
          <p className="text-xs text-muted-foreground">
            Crea link di prenotazione con disponibilità e calendario
          </p>
        </div>
        <Button onClick={() => { setNewName(""); setCreating(true); }} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Nuovo link
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />)}
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nessun link di prenotazione"
          description="Crea il tuo primo link per far prenotare appuntamenti."
          actionLabel="Nuovo link"
          onAction={() => { setNewName(""); setCreating(true); }}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Stato</TableHead>
                <TableHead className="hidden lg:table-cell">Durata</TableHead>
                <TableHead className="hidden xl:table-cell">Assegnato a</TableHead>
                <TableHead className="hidden lg:table-cell">Prenotazioni</TableHead>
                <TableHead className="hidden md:table-cell">Creato</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <button
                      onClick={() => router.push(`/booking-links/${link.id}`)}
                      className="font-medium hover:underline cursor-pointer text-left"
                    >
                      {link.name}
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[link.status])}>
                      {STATUS_LABELS[link.status]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{link.durationMinutes} min</TableCell>
                  <TableCell className="hidden max-w-52 truncate xl:table-cell text-sm text-muted-foreground">{link.assignedTo}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{link.bookingsCount}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(link.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => router.push(`/booking-links/${link.id}`)} title="Modifica">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {link.status === "active" && (
                        <a href={`/book/${link.slug}`} target="_blank" rel="noopener noreferrer" title="Apri">
                          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => duplicate(link)} title="Duplica">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => setDeleting(link)} title="Elimina">
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
          <DialogHeader><DialogTitle>Nuovo link di prenotazione</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                placeholder="Es. Consulenza 30 min"
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
          <DialogHeader><DialogTitle>Eliminare il link?</DialogTitle></DialogHeader>
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
