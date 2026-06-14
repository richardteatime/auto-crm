"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AvailabilityEditor } from "@/components/capture/AvailabilityEditor";
import { parseAvailability } from "@/lib/capture/availability";
import type { BookingLink, BookingAvailability } from "@/lib/capture/types";
import { toast } from "sonner";

export default function MyAvailabilityPage() {
  const [links, setLinks] = useState<BookingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BookingAvailability | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/my-booking-links")
      .then(async (res) => {
        if (!res.ok) throw new Error("Errore nel caricamento");
        return res.json();
      })
      .then((data: BookingLink[]) => setLinks(data))
      .catch(() => toast.error("Impossibile caricare i tuoi link di prenotazione"))
      .finally(() => setLoading(false));
  }, []);

  const startEditing = (link: BookingLink) => {
    setEditingId(link.id);
    setDraft(parseAvailability(link.availability));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft(null);
  };

  const save = async (link: BookingLink) => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/booking-links/${link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: JSON.stringify(draft) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore nel salvataggio");
      }
      const updated: BookingLink = await res.json();
      setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      toast.success("Disponibilità aggiornata");
      cancelEditing();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Caricamento…</div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold">Le mie disponibilità</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Non sei assegnato a nessun link di prenotazione.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">Le mie disponibilità</h1>
      {links.map((link) => (
        <div key={link.id} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">{link.name}</h2>
              <p className="text-xs text-muted-foreground">
                /book/{link.slug} · {link.durationMinutes} min ·{" "}
                {link.status === "active" ? "Attivo" : "In pausa"}
              </p>
            </div>
            {editingId !== link.id && (
              <Button size="sm" variant="outline" onClick={() => startEditing(link)}>
                Modifica
              </Button>
            )}
          </div>

          {editingId === link.id && draft && (
            <div className="space-y-3">
              <AvailabilityEditor availability={draft} onChange={setDraft} />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => save(link)}
                  disabled={saving}
                >
                  {saving ? "Salvataggio…" : "Salva"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  Annulla
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
