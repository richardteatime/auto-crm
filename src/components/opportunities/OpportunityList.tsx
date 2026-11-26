"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Download,
  Paperclip,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import { toast } from "sonner";
import { OpportunityForm, type OpportunityFormData } from "./OpportunityForm";
import { CloseReasonDialog } from "@/components/shared/CloseReasonDialog";

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
  closedOutcome?: string | null;
  closedReason?: string | null;
  closedBy?: string | null;
  closedAt?: number | string | Date | null;
  createdAt: number | Date;
}

const STATUS_CONFIG = {
  aperta:      { label: "Aperta",               variant: "secondary"   as const, className: "bg-blue-500/10 text-blue-700 border-blue-500/25 dark:bg-blue-950 dark:text-blue-300" },
  trasformata: { label: "Trasformata",          variant: "outline"     as const, className: "bg-green-500/10 text-green-700 border-green-500/25 dark:bg-green-950 dark:text-green-300" },
  chiusa:      { label: "Chiusa",               variant: "outline"     as const, className: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:bg-rose-950 dark:text-rose-300" },
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

interface OpportunityListProps {
  contactId: string;
}

export function OpportunityList({ contactId }: OpportunityListProps) {
  const router = useRouter();
  const [list, setList] = useState<OppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOpp, setEditingOpp] = useState<OpportunityFormData | undefined>();
  const [convertingOpp, setConvertingOpp] = useState<OppRow | null>(null);
  const [converting, setConverting] = useState(false);
  const [closingOpp, setClosingOpp] = useState<OppRow | null>(null);

  const load = useCallback(() => {
    fetch(`/api/opportunities?contactId=${contactId}`)
      .then((r) => r.json())
      .then((data) => { setList(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditingOpp(undefined); setShowForm(true); };
  const openEdit = (o: OppRow) => { setEditingOpp(toFormData(o)); setShowForm(true); };

  // Close with a reason: the opportunity (and its deal) stay in the customer history as "Chiusa"
  const handleClose = async (reason: string) => {
    if (!closingOpp) return;
    try {
      const res = await fetch(`/api/opportunities/${closingOpp.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Errore nella chiusura");
      toast.success(closingOpp.dealId ? "Opportunità e trattativa chiuse: restano nello storico" : "Opportunità chiusa: resta nello storico");
      setClosingOpp(null);
      load();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nella chiusura");
    }
  };

  const handleReopen = async (o: OppRow) => {
    try {
      const res = await fetch(`/api/opportunities/${o.id}/close`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Errore nella riapertura");
      toast.success("Opportunità riaperta");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nella riapertura");
    }
  };

  const handleConvert = async () => {
    if (!convertingOpp) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/opportunities/${convertingOpp.id}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nella conversione");
      toast.success("Opportunità trasformata in trattativa");
      setConvertingOpp(null);
      load();
      router.push(`/deals/${data.deal.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nella conversione");
    } finally {
      setConverting(false);
    }
  };

  const exportCsv = () => {
    window.open(`/api/opportunities?contactId=${contactId}&format=csv`, "_blank");
  };

  const openOnly = list.filter((o) => o.status === "aperta");
  const convertedOnly = list.filter((o) => o.status === "trasformata");
  const closedOnly = list.filter((o) => o.status === "chiusa");

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Opportunità ({list.length})
          </CardTitle>
          <div className="flex gap-2">
            {list.length > 0 && (
              <Button variant="outline" size="sm" className="cursor-pointer gap-1" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" />
                Esporta
              </Button>
            )}
            <Button size="sm" className="cursor-pointer gap-1" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Nuova
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nessuna opportunità. Creane una per tracciare il potenziale di questo contatto.
            </p>
          ) : (
            <div className="space-y-2">
              {openOnly.length > 0 && (
                <>
                  {openOnly.map((o) => <OppCard key={o.id} opp={o} onEdit={openEdit} onConvert={setConvertingOpp} onClose={setClosingOpp} onReopen={handleReopen} router={router} />)}
                </>
              )}
              {convertedOnly.length > 0 && (
                <>
                  {openOnly.length > 0 && <div className="border-t pt-2 mt-2" />}
                  <p className="text-xs text-muted-foreground font-medium mb-1">Trasformate in trattativa</p>
                  {convertedOnly.map((o) => <OppCard key={o.id} opp={o} onEdit={openEdit} onConvert={setConvertingOpp} onClose={setClosingOpp} onReopen={handleReopen} router={router} />)}
                </>
              )}
              {closedOnly.length > 0 && (
                <>
                  {(openOnly.length > 0 || convertedOnly.length > 0) && <div className="border-t pt-2 mt-2" />}
                  <p className="text-xs text-muted-foreground font-medium mb-1">Chiuse (storico)</p>
                  {closedOnly.map((o) => <OppCard key={o.id} opp={o} onEdit={openEdit} onConvert={setConvertingOpp} onClose={setClosingOpp} onReopen={handleReopen} router={router} />)}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <OpportunityForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingOpp(undefined); load(); }}
        contactId={contactId}
        initialData={editingOpp}
      />

      {/* Close with reason */}
      <CloseReasonDialog
        open={!!closingOpp}
        kind="opportunità"
        title={closingOpp?.title ?? ""}
        onCancel={() => setClosingOpp(null)}
        onConfirm={handleClose}
      />

      {/* Convert confirm */}
      <Dialog open={!!convertingOpp} onOpenChange={(v) => !v && setConvertingOpp(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Trasformare in trattativa?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{convertingOpp?.title}</strong> verrà aggiunta al pipeline come nuova trattativa. L&apos;opportunità rimarrà visibile come &quot;Trasformata&quot;.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => setConvertingOpp(null)} disabled={converting}>Annulla</Button>
            <Button className="cursor-pointer gap-1" onClick={handleConvert} disabled={converting}>
              <ArrowRight className="h-3.5 w-3.5" />
              {converting ? "Conversione..." : "Trasforma"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OppCard({
  opp,
  onEdit,
  onConvert,
  onClose,
  onReopen,
  router,
}: {
  opp: OppRow;
  onEdit: (o: OppRow) => void;
  onConvert: (o: OppRow) => void;
  onClose: (o: OppRow) => void;
  onReopen: (o: OppRow) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const attachments = parseAttachments(opp.attachments);
  const won = opp.status === "chiusa" && opp.closedOutcome === "vinta";
  const cfg = won
    ? { label: "Chiusa · vinta", className: "bg-green-500/10 text-green-700 border-green-500/25 dark:bg-green-950 dark:text-green-300" }
    : opp.status === "chiusa"
      ? { ...STATUS_CONFIG.chiusa, label: "Chiusa · persa" }
      : STATUS_CONFIG[opp.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.aperta;
  const isOpen = opp.status === "aperta";

  return (
    <div className="rounded-lg border p-3 space-y-2 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{opp.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.className}`}>
              {cfg.label}
            </span>
          </div>
          {opp.value != null && (
            <p className="text-sm font-semibold text-primary mt-0.5">{formatCurrency(opp.value)}</p>
          )}
          {opp.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{opp.description}</p>
          )}
          {opp.notes && (
            <p className="mt-2 whitespace-pre-line rounded-md border bg-muted/40 px-2.5 py-2 text-[13px] leading-relaxed line-clamp-6">
              {opp.notes}
            </p>
          )}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {attachments.map((a) => (
                <a
                  key={a.url}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                  <Paperclip className="h-3 w-3" />
                  {a.name}
                </a>
              ))}
            </div>
          )}
          {opp.status === "chiusa" && (
            <p className={`mt-2 rounded-md border px-2.5 py-2 text-[13px] leading-relaxed ${won ? "border-green-500/25 bg-green-500/[0.05]" : "border-rose-500/25 bg-rose-500/[0.05]"}`}>
              <span className="text-muted-foreground">Motivo: </span>
              {opp.closedReason || "non indicato"}
              {(opp.closedBy || opp.closedAt) && (
                <span className="block text-xs text-muted-foreground">
                  {opp.closedBy ? `Chiusa da ${opp.closedBy}` : "Chiusa"}
                  {opp.closedAt ? ` il ${formatDate(new Date(opp.closedAt))}` : ""}
                </span>
              )}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{formatDate(opp.createdAt)}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(opp.status === "trasformata" || opp.status === "chiusa") && opp.dealId && (
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer h-7 text-xs gap-1 text-green-700"
              onClick={() => router.push(`/deals/${opp.dealId}`)}
            >
              <ArrowRight className="h-3 w-3" />
              Trattativa
            </Button>
          )}
          {isOpen && (
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer h-7 text-xs gap-1"
              onClick={() => onConvert(opp)}
              title="Trasforma in trattativa"
            >
              <ArrowRight className="h-3 w-3" />
              Converti
            </Button>
          )}
          {opp.status === "chiusa" && !opp.dealId && (
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer h-7 text-xs gap-1"
              onClick={() => onReopen(opp)}
              title="Riapri l'opportunità"
            >
              <RotateCcw className="h-3 w-3" />
              Riapri
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer h-7 w-7"
            onClick={() => onEdit(opp)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {opp.status !== "chiusa" && (
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onClose(opp)}
              title="Chiudi come persa (resta nello storico)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
