"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Target, Pencil, Trash2, ArrowRight, Download, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import { OpportunityForm, type OpportunityFormData } from "@/components/opportunities/OpportunityForm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OppRow {
  id: string;
  contactId: string;
  title: string;
  description: string | null;
  notes: string | null;
  attachments: string | null;
  status: string;
  value: number | null;
  dealId: string | null;
  createdAt: number | Date;
}

const STATUS_CONFIG = {
  aperta:      { label: "Aperta",      className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300" },
  trasformata: { label: "Trasformata", className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300" },
};

function parseAttachments(json: string | null): { name: string; url: string }[] {
  try { return JSON.parse(json || "[]"); } catch { return []; }
}

function toFormData(o: OppRow): OpportunityFormData {
  return {
    id: o.id,
    title: o.title,
    description: o.description || "",
    notes: o.notes || "",
    value: o.value != null ? (o.value / 100).toFixed(2) : "",
    attachments: parseAttachments(o.attachments),
  };
}

export default function OpportunitaPage() {
  const router = useRouter();
  const [opps, setOpps] = useState<OppRow[]>([]);
  const [contactNames, setContactNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "aperta" | "trasformata">("");
  const [showForm, setShowForm] = useState(false);
  const [editingOpp, setEditingOpp] = useState<OpportunityFormData | undefined>();
  const [editingContactId, setEditingContactId] = useState("");
  const [deletingOpp, setDeletingOpp] = useState<OppRow | null>(null);
  const [convertingOpp, setConvertingOpp] = useState<OppRow | null>(null);
  const [converting, setConverting] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/opportunities").then((r) => r.json()),
      fetch("/api/contacts").then((r) => r.json()),
    ])
      .then(([oppsData, contactsData]) => {
        setOpps(Array.isArray(oppsData) ? oppsData : []);
        setContactNames(
          new Map(
            (Array.isArray(contactsData) ? contactsData : []).map(
              (c: { id: string; name: string }) => [c.id, c.name]
            )
          )
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCount = useMemo(() => opps.filter((o) => o.status === "aperta").length, [opps]);
  const convertedCount = useMemo(() => opps.filter((o) => o.status === "trasformata").length, [opps]);
  const totalOpenValue = useMemo(
    () => opps.filter((o) => o.status === "aperta").reduce((sum, o) => sum + (o.value ?? 0), 0),
    [opps]
  );
  const conversionRate = opps.length > 0 ? Math.round((convertedCount / opps.length) * 100) : 0;

  const filtered = useMemo(() => opps.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = contactNames.get(o.contactId) || "";
      if (!o.title.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [opps, filterStatus, search, contactNames]);

  const openEdit = (o: OppRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOpp(toFormData(o));
    setEditingContactId(o.contactId);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deletingOpp) return;
    try {
      const res = await fetch(`/api/opportunities/${deletingOpp.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setOpps((prev) => prev.filter((o) => o.id !== deletingOpp.id));
      toast.success("Opportunità eliminata");
    } catch {
      toast.error("Errore durante l'eliminazione");
    } finally {
      setDeletingOpp(null);
    }
  };

  const handleConvert = async () => {
    if (!convertingOpp) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/opportunities/${convertingOpp.id}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore");
      toast.success("Opportunità trasformata in trattativa");
      setConvertingOpp(null);
      load();
      router.push(`/deals/${data.deal.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setConverting(false);
    }
  };

  const kpis = [
    { label: "Totale", value: String(opps.length), sub: "opportunità", color: "" },
    { label: "Aperte", value: String(openCount), sub: "in corso", color: "text-blue-600" },
    { label: "Trasformate", value: String(convertedCount), sub: "in trattativa", color: "text-green-600" },
    { label: "Tasso conversione", value: `${conversionRate}%`, sub: "aperte → trattative", color: conversionRate >= 50 ? "text-green-600" : "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Opportunità</h1>
          <p className="text-muted-foreground">Analisi completa — aperte e trasformate in trattativa</p>
        </div>
        <Button
          variant="outline" size="sm"
          className="cursor-pointer gap-1.5"
          onClick={() => window.open("/api/opportunities?format=csv", "_blank")}
        >
          <Download className="h-3.5 w-3.5" />
          Esporta CSV
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{k.label}</p>
              <p className={cn("text-2xl font-bold mt-1", k.color)}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Valore potenziale aperte */}
      {openCount > 0 && (
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valore potenziale opportunità aperte</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{formatCurrency(totalOpenValue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{openCount} opportunità ancora aperte</p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per titolo o contatto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {([
            { key: "", label: `Tutte (${opps.length})` },
            { key: "aperta", label: `Aperte (${openCount})` },
            { key: "trasformata", label: `Trasformate (${convertedCount})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer",
                filterStatus === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : opps.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nessuna opportunità ancora</p>
          <p className="text-sm mt-1">Crea opportunità dalla pagina del contatto per tracciarle qui.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Contatto</TableHead>
                  <TableHead>Valore</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="hidden md:table-cell">Creata il</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                      Nessuna opportunità corrisponde ai filtri.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((o) => {
                  const cfg = STATUS_CONFIG[o.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.aperta;
                  const contactName = contactNames.get(o.contactId);
                  return (
                    <TableRow key={o.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{o.title}</p>
                          {o.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-52">{o.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contactName ? (
                          <button
                            onClick={() => router.push(`/contacts/${o.contactId}`)}
                            className="text-primary hover:underline text-sm cursor-pointer text-left"
                          >
                            {contactName}
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-primary text-sm">
                          {o.value != null ? formatCurrency(o.value) : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", cfg.className)}>
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDate(o.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          {o.status === "trasformata" && o.dealId && (
                            <Button
                              variant="ghost" size="sm"
                              className="cursor-pointer h-7 text-xs gap-1 text-green-700 hover:text-green-700"
                              onClick={() => router.push(`/deals/${o.dealId!}`)}
                            >
                              <ArrowRight className="h-3 w-3" />
                              Trattativa
                            </Button>
                          )}
                          {o.status === "aperta" && (
                            <Button
                              variant="ghost" size="sm"
                              className="cursor-pointer h-7 text-xs gap-1"
                              onClick={() => setConvertingOpp(o)}
                            >
                              <ArrowRight className="h-3 w-3" />
                              Converti
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            className="cursor-pointer h-7 w-7"
                            onClick={(e) => openEdit(o, e)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="cursor-pointer h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingOpp(o)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {filtered.length} di {opps.length} opportunità
          </p>
        </>
      )}

      <OpportunityForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingOpp(undefined); load(); }}
        contactId={editingContactId}
        initialData={editingOpp}
      />

      <Dialog open={!!deletingOpp} onOpenChange={(v) => !v && setDeletingOpp(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Eliminare l&apos;opportunità?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per eliminare <strong>{deletingOpp?.title}</strong>. Questa azione è irreversibile.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => setDeletingOpp(null)}>Annulla</Button>
            <Button variant="destructive" className="cursor-pointer" onClick={handleDelete}>Elimina</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!convertingOpp} onOpenChange={(v) => !v && setConvertingOpp(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Trasformare in trattativa?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{convertingOpp?.title}</strong> verrà aggiunta al pipeline come nuova trattativa.
            L&apos;opportunità rimarrà visibile qui come &quot;Trasformata&quot;.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => setConvertingOpp(null)} disabled={converting}>
              Annulla
            </Button>
            <Button className="cursor-pointer gap-1" onClick={handleConvert} disabled={converting}>
              <ArrowRight className="h-3.5 w-3.5" />
              {converting ? "Conversione..." : "Trasforma"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
