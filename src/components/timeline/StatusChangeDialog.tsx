"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PROJECT_STATUS_OPTIONS, PROJECT_STATUS_CONFIG } from "./projectConstants";
import type { ProjectStatus } from "@/types";

interface StatusChangeDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  currentStatus: ProjectStatus;
  currentAssignedTo?: string | null;
}

export function StatusChangeDialog({ open, onClose, projectId, currentStatus, currentAssignedTo }: StatusChangeDialogProps) {
  const [toStatus, setToStatus] = useState<ProjectStatus>(currentStatus);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>(currentAssignedTo ?? "__none__");
  const [teamUsers, setTeamUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);

  useEffect(() => {
    if (!open) return;
    setToStatus(currentStatus);
    setAssignedTo(currentAssignedTo ?? "__none__");
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTeamUsers(data); })
      .catch(() => {});
  }, [open, currentStatus, currentAssignedTo]);

  const handleSave = async () => {
    if (!notes.trim()) {
      toast.error("Inserisci le modifiche effettuate");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { toStatus, notes };
      if (assignedTo !== "__none__") body.assignedTo = assignedTo;
      else body.assignedTo = null;

      const res = await fetch(`/api/projects/${projectId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success("Stato aggiornato");
      setNotes("");
      onClose();
    } catch {
      toast.error("Errore durante l'aggiornamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiorna Stato Progetto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nuovo stato</Label>
            <Select value={toStatus} onValueChange={(v) => setToStatus(v as ProjectStatus)}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PROJECT_STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assegnato a</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Seleziona membro del team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nessuno</SelectItem>
                {teamUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cosa è stato fatto / motivo del cambio *</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="es. Completato il modulo di login, aggiunto sistema di autenticazione JWT. Prossimo step: pagina dashboard..."
            />
            <p className="text-xs text-muted-foreground">Campo obbligatorio — serve allo storico del progetto.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose} className="cursor-pointer">Annulla</Button>
            <Button onClick={handleSave} disabled={saving || !notes.trim()} className="cursor-pointer">
              {saving ? "Salvataggio..." : "Salva aggiornamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
