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
import { Plus, LayoutTemplate, ExternalLink, Copy, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/constants";
import { ASSET_STATUS_LABELS } from "@/lib/capture/types";
import type { LandingPage, LandingTemplate } from "@/lib/capture/types";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};

export default function LandingPagesPage() {
  const router = useRouter();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState<LandingTemplate[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<LandingPage | null>(null);

  const load = () => {
    fetch("/api/landing-pages")
      .then((res) => res.json())
      .then((data) => {
        setPages(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch("/api/landing-templates")
      .then((res) => res.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]));
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), templateId: templateId || null }),
      });
      if (!res.ok) throw new Error();
      const page = await res.json();
      toast.success("Landing page creata");
      router.push(`/landing-pages/${page.id}`);
    } catch {
      toast.error("Errore nella creazione");
      setBusy(false);
    }
  };

  const duplicate = async (page: LandingPage) => {
    try {
      const res = await fetch(`/api/landing-pages/${page.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Landing page duplicata");
      load();
    } catch {
      toast.error("Errore nella duplicazione");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/landing-pages/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setPages((prev) => prev.filter((p) => p.id !== deleting.id));
      toast.success("Landing page eliminata");
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
          <h1 className="text-lg font-semibold tracking-tight">Landing Page</h1>
          <p className="text-xs text-muted-foreground">
            Crea pagine di atterraggio per catturare lead
          </p>
        </div>
        <Button onClick={() => { setNewName(""); setTemplateId(""); setCreating(true); }} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Nuova landing page
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />)}
        </div>
      ) : pages.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Nessuna landing page"
          description="Crea la tua prima landing page per iniziare a catturare lead."
          actionLabel="Nuova landing page"
          onAction={() => { setNewName(""); setTemplateId(""); setCreating(true); }}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Stato</TableHead>
                <TableHead className="hidden lg:table-cell">Visite</TableHead>
                <TableHead className="hidden lg:table-cell">Lead</TableHead>
                <TableHead className="hidden md:table-cell">Creata</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell>
                    <button
                      onClick={() => router.push(`/landing-pages/${page.id}`)}
                      className="font-medium hover:underline cursor-pointer text-left"
                    >
                      {page.name}
                    </button>
                    <p className="text-xs text-muted-foreground">/l/{page.slug}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[page.status])}>
                      {ASSET_STATUS_LABELS[page.status]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{page.views}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{page.submissions}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(page.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => router.push(`/landing-pages/${page.id}`)} title="Modifica">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {page.status === "published" && (
                        <a href={`/l/${page.slug}`} target="_blank" rel="noopener noreferrer" title="Apri">
                          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => duplicate(page)} title="Duplica">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => setDeleting(page)} title="Elimina">
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
          <DialogHeader><DialogTitle>Nuova landing page</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                placeholder="Es. Promo Primavera"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Base vuota</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
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
          <DialogHeader><DialogTitle>Eliminare la landing page?</DialogTitle></DialogHeader>
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
