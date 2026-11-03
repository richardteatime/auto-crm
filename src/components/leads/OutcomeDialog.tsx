"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, PhoneOff, CalendarClock, CalendarCheck, FileText, ThumbsDown, Ban, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { burstConfetti } from "@/lib/confetti";
import { CALL_OUTCOMES, OUTCOME_CONFIG, LOST_REASONS, type CallOutcome, type Lead } from "@/lib/leads/types";
import { datePresets, defaultNextAction, toLocalInput } from "./lead-ui";

const ICONS: Record<CallOutcome, typeof PhoneOff> = {
  non_risponde: PhoneOff,
  richiamare: CalendarClock,
  appuntamento: CalendarCheck,
  proposta: FileText,
  non_interessato: ThumbsDown,
  non_valido: Ban,
  vinto: Trophy,
};

const TONE: Partial<Record<CallOutcome, string>> = {
  appuntamento: "text-violet-600 dark:text-violet-300",
  proposta: "text-indigo-600 dark:text-indigo-300",
  vinto: "text-emerald-600 dark:text-emerald-300",
  non_interessato: "text-muted-foreground",
  non_valido: "text-muted-foreground",
};

export function OutcomeDialog({
  lead,
  open,
  onOpenChange,
  onSaved,
}: {
  lead: Lead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (lead: Lead) => void;
}) {
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState<string>(LOST_REASONS[0]);
  const [valueEur, setValueEur] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOutcome(null);
    setWhen("");
    setReason(LOST_REASONS[0]);
    setValueEur(lead.value ? String(Math.round(lead.value / 100)) : "");
    setNote("");
  }, [open, lead.value]);

  function pick(o: CallOutcome) {
    setOutcome(o);
    const d = defaultNextAction(o);
    setWhen(d ? toLocalInput(d) : "");
  }

  const cfg = outcome ? OUTCOME_CONFIG[outcome] : null;
  const needsDate = !!cfg?.needsDate;
  const dateRequired = outcome === "appuntamento" || outcome === "richiamare";

  async function save() {
    if (!outcome) return;
    if (dateRequired && !when) {
      toast.error(outcome === "appuntamento" ? "Indica data e ora dell'appuntamento" : "Indica quando richiamare");
      return;
    }
    setSaving(true);
    try {
      const value = valueEur.trim() ? Math.round(parseFloat(valueEur.replace(/\./g, "").replace(",", ".")) * 100) : null;
      const res = await fetch(`/api/leads/${lead.id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          note: note.trim() || null,
          nextActionAt: needsDate && when ? new Date(when).toISOString() : null,
          lostReason: cfg?.needsReason ? reason : null,
          value: cfg?.needsValue && value != null && !Number.isNaN(value) ? value : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Errore");
      if (outcome === "vinto") burstConfetti();
      toast.success(`Esito salvato: ${OUTCOME_CONFIG[outcome].label}`, { description: lead.name });
      onOpenChange(false);
      onSaved?.(data as Lead);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Non sono riuscito a salvare l'esito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Com&apos;è andata la chiamata?</DialogTitle>
          <DialogDescription>
            {lead.name}
            {lead.company ? ` · ${lead.company}` : ""}
            {lead.callAttempts > 0 ? ` · ${lead.callAttempts} tentativ${lead.callAttempts === 1 ? "o" : "i"} finora` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Esito della chiamata">
          {CALL_OUTCOMES.map((o) => {
            const Icon = ICONS[o];
            const active = outcome === o;
            return (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pick(o)}
                className={cn(
                  "flex h-12 items-center gap-2.5 rounded-lg border bg-card px-3 text-left text-sm font-medium shadow-card transition-all",
                  active ? "border-primary bg-primary/[0.06] ring-4 ring-primary/12" : "hover:border-input hover:bg-muted/40",
                  o === "vinto" && "col-span-2"
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-primary" : TONE[o] ?? "text-muted-foreground")} />
                {OUTCOME_CONFIG[o].label}
              </button>
            );
          })}
        </div>

        {needsDate && (
          <div className="space-y-2">
            <Label htmlFor="next-at">
              {outcome === "appuntamento" ? "Data e ora dell'appuntamento" : outcome === "proposta" ? "Quando risentirlo" : "Quando richiamare"}
              {!dateRequired && <span className="font-normal text-muted-foreground"> (facoltativo)</span>}
            </Label>
            {outcome !== "appuntamento" && (
              <div className="flex flex-wrap gap-1.5">
                {datePresets().map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setWhen(toLocalInput(p.date))}
                    className={cn(
                      "h-7 rounded-md border bg-card px-2 text-xs font-medium transition-colors hover:bg-muted",
                      when === toLocalInput(p.date) && "border-primary text-primary"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <input
              id="next-at"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="h-10 w-full rounded-lg border bg-card px-3 text-sm shadow-card outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
            />
          </div>
        )}

        {cfg?.needsReason && (
          <div className="space-y-2">
            <Label>Motivo</Label>
            <div className="flex flex-wrap gap-1.5">
              {LOST_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "h-8 rounded-md border bg-card px-2.5 text-xs font-medium transition-colors hover:bg-muted",
                    reason === r && "border-primary bg-primary/[0.06] text-primary"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {cfg?.needsValue && (
          <div className="space-y-2">
            <Label htmlFor="won-value">Valore del contratto (€)</Label>
            <input
              id="won-value"
              inputMode="decimal"
              placeholder="es. 2.500"
              value={valueEur}
              onChange={(e) => setValueEur(e.target.value)}
              className="h-10 w-full rounded-lg border bg-card px-3 text-sm shadow-card outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
            />
          </div>
        )}

        {outcome && (
          <div className="space-y-2">
            <Label htmlFor="outcome-note">Nota <span className="font-normal text-muted-foreground">(facoltativa)</span></Label>
            <Textarea
              id="outcome-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cosa vi siete detti, budget, chi decide…"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button type="button" onClick={save} disabled={!outcome || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Salva esito
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
