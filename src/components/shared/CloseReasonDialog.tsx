"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LOST_REASONS, WON_REASONS, CLOSE_REASON_MAX } from "@/lib/close-reasons";

/** Combines the chosen reason and the free text into the string saved on the deal/opportunity */
function buildReason(choice: string, text: string): string {
  const t = text.trim();
  if (!choice || choice === "Altro") return t || (choice ?? "");
  return t ? `${choice}: ${t}` : choice;
}

/**
 * Asked when a deal or an opportunity is closed (deal moved to "Vinta" or "Persa", opportunity "Chiudi").
 * The reason is required and is saved with who closed it. The item is NOT deleted: it stays in the history.
 */
export function CloseReasonDialog({
  open,
  title,
  kind,
  outcome = "persa",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** Name of the deal/opportunity being closed */
  title: string;
  kind: "trattativa" | "opportunità";
  /** "vinta": asks why it was won; "persa" (default): why it was lost/closed */
  outcome?: "vinta" | "persa";
  /** Throw (or reject) to keep the dialog open */
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setChoice("");
      setText("");
      setSaving(false);
    }
  }, [open]);

  const won = outcome === "vinta";
  const reasons = won ? WON_REASONS : LOST_REASONS;
  const reason = buildReason(choice, text);
  const valid = reason.length >= 3 && reason.length <= CLOSE_REASON_MAX;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onConfirm(reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{won ? `Perché l'hai vinta?` : `Perché chiudi questa ${kind}?`}</DialogTitle>
          <DialogDescription>
            {title}. Resta nello storico del cliente, con il motivo che scrivi qui.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setChoice(r)}
              className={cn(
                "h-8 rounded-md border bg-card px-2.5 text-xs font-medium transition-colors hover:bg-muted cursor-pointer",
                choice === r && "border-primary bg-primary/[0.06] text-primary"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Textarea
          rows={3}
          maxLength={CLOSE_REASON_MAX - 40}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={choice === "Altro" || !choice ? "Scrivi il motivo…" : "Dettagli (facoltativo)"}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="cursor-pointer" onClick={onCancel} disabled={saving}>
            Annulla
          </Button>
          <Button className="cursor-pointer" onClick={submit} disabled={!valid || saving}>
            {saving && <Loader2 className="animate-spin" />}
            {won ? "Segna come vinta" : kind === "trattativa" ? "Chiudi la trattativa" : "Chiudi l'opportunità"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
