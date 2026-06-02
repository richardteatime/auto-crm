"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Mail,
  FileText,
  History,
  PhoneCall,
  Workflow,
  GitBranch,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/constants";
import {
  LEAD_PIPELINE_STAGES,
  CALL_OUTCOMES,
  STAGE_LABELS,
  OUTCOME_LABELS,
  type Lead,
  type PipelineMovement,
  type AutomationRun,
  type CallTask,
  type LeadQuote,
  type LeadPipelineStage,
  type CallOutcome,
} from "@/lib/leads/types";
import {
  StageBadge,
  CategoryBadge,
  ScoreBadge,
  StatusBadge,
  OutcomeBadge,
} from "./lead-badges";

interface LeadDetailProps {
  lead: Lead;
  movements: PipelineMovement[];
  runs: AutomationRun[];
  callTasks: CallTask[];
  quotes: LeadQuote[];
  // Two-call funnel identities (from env, resolved server-side).
  setterId: string;
  setterName: string;
  closerName: string;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function parseCustomFields(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const RUN_STATUS_COLORS: Record<string, string> = {
  completed: "#16a34a",
  partial: "#d97706",
  failed: "#dc2626",
  running: "#2563eb",
  pending: "#6b7280",
};

export function LeadDetail({
  lead,
  movements,
  runs,
  callTasks,
  quotes,
  setterId,
  setterName,
  closerName,
}: LeadDetailProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [targetStage, setTargetStage] = useState<LeadPipelineStage>(
    lead.pipelineStage,
  );
  const [outcome, setOutcome] = useState<CallOutcome>("qualified");
  const [callNotes, setCallNotes] = useState("");

  const customFields = parseCustomFields(lead.customFields);
  const customEntries = Object.entries(customFields);
  const latestQuote = quotes[0] ?? null;
  const openTask =
    callTasks.find((t) => t.status === "pending" || t.status === "scheduled") ??
    callTasks[0] ??
    null;

  // Which call are we on? The setter (Cugina) runs call 1; once the lead is
  // escalated, the open task belongs to the closer (Leo) → call 2.
  const isSetterCall = !openTask || openTask.assignedTo === setterId;
  const isClosingCall = !isSetterCall;

  async function call(
    label: string,
    url: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setBusy(label);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Operazione fallita");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      toast.error("Errore di rete");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function moveStage() {
    const ok = await call("move", `/api/leads/${lead.id}/move-stage`, {
      toStage: targetStage,
    });
    if (ok) toast.success(`Lead spostato in ${STAGE_LABELS[targetStage]}`);
  }

  async function recordOutcome() {
    const ok = await call("outcome", `/api/leads/${lead.id}/call-outcome`, {
      outcome,
      notes: callNotes || undefined,
    });
    if (ok) {
      toast.success("Esito chiamata registrato");
      setCallNotes("");
    }
  }

  // Cugina passes a qualified lead to Leo and opens his calendar pre-filled.
  async function escalateToLeo() {
    setBusy("escalate");
    try {
      const res = await fetch(`/api/leads/${lead.id}/escalate-to-leo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Passaggio fallito");
        return;
      }
      toast.success(`Passato a ${closerName} — apertura calendario…`);
      if (data.bookingUrl) window.open(data.bookingUrl as string, "_blank");
      router.refresh();
    } catch {
      toast.error("Errore di rete");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(status: "won" | "lost", label: string) {
    const ok = await call(`status-${status}`, `/api/leads/${lead.id}/set-status`, {
      status,
    });
    if (ok) toast.success(label);
  }

  async function generateQuote(regenerate: boolean) {
    const ok = await call("quote", `/api/leads/${lead.id}/generate-quote`, {
      regenerate,
    });
    if (ok) toast.success("Bozza preventivo generata");
  }

  async function convertToQuote() {
    setBusy("convert");
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert-to-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Conversione fallita");
        return;
      }
      toast.success("Preventivo creato — apertura PDF…");
      if (data.pdfUrl) window.open(data.pdfUrl as string, "_blank");
      router.refresh();
    } catch {
      toast.error("Errore di rete");
    } finally {
      setBusy(null);
    }
  }

  const company = lead.company ?? lead.businessName;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/leads">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{lead.fullName}</h1>
          <p className="text-sm text-muted-foreground">{lead.id}</p>
        </div>
        <ScoreBadge score={lead.leadScore} />
        <StageBadge stage={lead.pipelineStage} />
      </div>

      {/* Overview + dati estratti */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Dati lead
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Email" value={lead.email} />
          <Field label="Telefono" value={lead.phone} />
          <Field label="Azienda" value={company} />
          <Field label="Sito web" value={lead.website} />
          <Field label="Tipo progetto" value={lead.projectType} />
          <div>
            <p className="text-xs text-muted-foreground mb-1">Categoria</p>
            <CategoryBadge category={lead.category} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Stato</p>
            <StatusBadge status={lead.status} />
          </div>
          <Field label="Fonte" value={lead.source} />
          <Field label="Form" value={lead.formName} />
          <Field label="Creato" value={formatDate(lead.createdAt)} />
          <Field label="Aggiornato" value={formatDate(lead.updatedAt)} />
        </CardContent>
      </Card>

      {/* Richiesta + move stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Richiesta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">
              {lead.message?.trim() || "(nessun dettaglio fornito)"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Workflow className="h-4 w-4" />
              Sposta in pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              value={targetStage}
              onChange={(e) =>
                setTargetStage(e.target.value as LeadPipelineStage)
              }
              className="w-full h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              {LEAD_PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
            <Button
              onClick={moveStage}
              disabled={busy === "move"}
              className="w-full"
            >
              {busy === "move" ? "Spostamento..." : "Sposta lead"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Lo spostamento attiva le automazioni della fase e viene tracciato.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Call task + outcome — context-aware: Call 1 (Cugina) vs Call 2 (Leo) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PhoneCall className="h-4 w-4" />
            {isClosingCall
              ? `Call 2 — ${closerName} (chiusura)`
              : `Call 1 — ${setterName} (scrematura a freddo)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {openTask ? (
            <div className="flex flex-wrap items-center gap-3 text-sm border rounded-lg p-3">
              <Badge variant="outline">{openTask.status}</Badge>
              <span className="text-muted-foreground">
                Assegnata a {openTask.assigneeName ?? openTask.assignedTo}
              </span>
              {openTask.callOutcome && (
                <OutcomeBadge outcome={openTask.callOutcome} />
              )}
              {openTask.scheduledAt && (
                <span className="text-xs text-muted-foreground">
                  Programmata: {formatDate(openTask.scheduledAt)}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nessuna call task aperta. Ne viene creata una automaticamente
              all&apos;arrivo del lead.
            </p>
          )}

          {/* Azione principale della setter: passa a Leo e prenota la chiusura */}
          {!isClosingCall && (
            <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
              <p className="text-sm font-medium text-indigo-900">
                Lead qualificato? Passa la palla a {closerName}.
              </p>
              <p className="text-xs text-indigo-700/80">
                Crea la call di chiusura e apre il calendario di {closerName} già
                compilato col cliente: scegli lo slot e confermi.
              </p>
              <Button
                onClick={escalateToLeo}
                disabled={busy === "escalate"}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {busy === "escalate"
                  ? "Passaggio…"
                  : `Passa a ${closerName} → prenota call`}
              </Button>
            </div>
          )}

          {/* Esito chiamata (per entrambe le call) + chiusura rapida */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as CallOutcome)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              {CALL_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABELS[o]}
                </option>
              ))}
            </select>
            <Textarea
              placeholder="Note chiamata (opzionale)"
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              className="sm:col-span-2 min-h-9"
              rows={2}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={recordOutcome} disabled={busy === "outcome"}>
              {busy === "outcome" ? "Salvataggio..." : "Registra esito"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStatus("won", "Lead segnato come Vinto")}
              disabled={busy === "status-won"}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              {busy === "status-won" ? "..." : "Segna Vinto"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStatus("lost", "Lead segnato come Perso")}
              disabled={busy === "status-lost"}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {busy === "status-lost" ? "..." : "Segna Perso"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isClosingCall
              ? `Esito di ${closerName}: qualified/interested/needs_quote → preventivo, no_answer/call_later → follow-up, non interessato → perso.`
              : `Esito di ${setterName}: qualified/interested/needs_quote → passa a ${closerName}, no_answer/call_later → follow-up, non interessato → perso. In alternativa usa “Passa a ${closerName}” per prenotare subito la call di chiusura.`}
          </p>
        </CardContent>
      </Card>

      {/* Quote draft */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Bozza preventivo
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={convertToQuote}
              disabled={busy === "convert"}
            >
              {busy === "convert" ? "Creazione..." : "Trasforma in preventivo"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateQuote(Boolean(latestQuote))}
              disabled={busy === "quote"}
            >
              {busy === "quote"
                ? "Generazione..."
                : latestQuote
                  ? "Rigenera bozza"
                  : "Genera preventivo"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {latestQuote ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline">{latestQuote.status}</Badge>
                <CategoryBadge category={latestQuote.category} />
                <span className="text-sm font-medium">
                  {formatCurrency(latestQuote.amountSuggested)}
                </span>
              </div>
              <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded border overflow-x-auto">
                {latestQuote.generatedText ?? latestQuote.summary ?? "—"}
              </pre>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
                Bozza interna — non inviata al cliente senza approvazione manuale.
              </p>
              <p className="text-xs text-muted-foreground">
                Premi <strong>Trasforma in preventivo</strong> per generare il documento
                PDF ufficiale (collegato a una trattativa), con lo stesso layout dei Preventivi.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nessuna bozza. Viene generata automaticamente quando il lead entra
              in proposal, oppure manualmente qui.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Custom fields + raw email */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campi personalizzati</CardTitle>
          </CardHeader>
          <CardContent>
            {customEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun campo personalizzato.
              </p>
            ) : (
              <div className="space-y-1.5">
                {customEntries.map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground min-w-32">{k}</span>
                    <span className="font-medium break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email raw</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Field label="Oggetto" value={lead.rawSubject} />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Corpo</p>
              <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded border max-h-64 overflow-auto">
                {lead.rawBody?.trim() || "(vuoto)"}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automation history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Automation runs ({runs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna automazione registrata.
            </p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => {
                const actions = parseJsonArray(run.actionsExecuted);
                const color = RUN_STATUS_COLORS[run.status] ?? "#6b7280";
                return (
                  <div
                    key={run.id}
                    className="border rounded-lg p-3 text-sm space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{run.triggerType}</Badge>
                      <Badge
                        variant="outline"
                        style={{ color, borderColor: color }}
                      >
                        {run.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDate(run.createdAt)}
                      </span>
                    </div>
                    {actions.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-0.5 font-mono">
                        {actions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    )}
                    {run.error && (
                      <p className="text-xs text-red-600">{run.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline movements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Storico pipeline ({movements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessun movimento registrato.
            </p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 text-sm border-b last:border-0 pb-2 last:pb-0"
                >
                  <span className="font-medium">
                    {m.fromStage ? `${m.fromStage} → ` : ""}
                    {m.toStage}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {m.triggeredBy}
                  </Badge>
                  {m.reason && (
                    <span className="text-xs text-muted-foreground">
                      {m.reason}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDate(m.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium break-words">{value || "—"}</p>
    </div>
  );
}
