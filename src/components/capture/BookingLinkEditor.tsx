"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Save, ExternalLink, Play, Pause, ClipboardCopy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { parseAvailability } from "@/lib/capture/availability";
import type {
  BookingAppointment, BookingLink, BookingAvailability, BookingLinkStatus,
} from "@/lib/capture/types";

const STATUS_STYLES: Record<BookingLinkStatus, string> = {
  active: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300",
  paused: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
  archived: "bg-muted text-muted-foreground",
};
const STATUS_LABELS: Record<BookingLinkStatus, string> = {
  active: "Attivo", paused: "In pausa", archived: "Archiviato",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function numberOr(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function formatAppointmentDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function BookingLinkEditor({ link, appointments }: { link: BookingLink; appointments: BookingAppointment[] }) {
  const router = useRouter();
  const [name, setName] = useState(link.name);
  const [assignedTo, setAssignedTo] = useState(link.assignedTo);
  const [durationMinutes, setDurationMinutes] = useState(link.durationMinutes);
  const [successMessage, setSuccessMessage] = useState(link.successMessage);
  const [redirectUrl, setRedirectUrl] = useState(link.redirectUrl ?? "");
  const [status, setStatus] = useState<BookingLinkStatus>(link.status);
  const [availability, setAvailability] = useState<BookingAvailability>(() =>
    parseAvailability(link.availability),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const touch = () => setDirty(true);

  const persist = async (nextStatus?: BookingLinkStatus) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/booking-links/${link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Senza nome",
          assignedTo: assignedTo.trim(),
          durationMinutes,
          availability: JSON.stringify(availability),
          successMessage,
          redirectUrl,
          ...(nextStatus ? { status: nextStatus } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore");
      }
      if (nextStatus) setStatus(nextStatus);
      setDirty(false);
      toast.success(
        nextStatus === "active" ? "Link attivato"
          : nextStatus === "paused" ? "Link messo in pausa"
          : "Modifiche salvate",
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Link copiato")).catch(() => toast.error("Copia non riuscita"));
  };
  const directLink = `${origin}/book/${link.slug}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => router.push("/booking-links")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight">{name || "Senza nome"}</h1>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>
          </div>
          <p className="text-xs text-muted-foreground">{durationMinutes} min · {link.bookingsCount} prenotazioni</p>
        </div>

        {status === "active" && (
          <a href={directLink} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="cursor-pointer">
              <ExternalLink className="h-4 w-4 mr-1" /> Apri
            </Button>
          </a>
        )}

        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => persist()} disabled={saving || !dirty}>
          <Save className="h-4 w-4 mr-1" /> Salva
        </Button>

        {status === "active" ? (
          <Button size="sm" className="cursor-pointer" onClick={() => persist("paused")} disabled={saving}>
            <Pause className="h-4 w-4 mr-1" /> Metti in pausa
          </Button>
        ) : (
          <Button size="sm" className="cursor-pointer" onClick={() => persist("active")} disabled={saving}>
            <Play className="h-4 w-4 mr-1" /> Attiva
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Availability */}
        <AvailabilityEditor
          availability={availability}
          onChange={(next) => {
            setAvailability(next);
            touch();
          }}
        />

        {/* Details */}
        <div className="space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Dettagli</h2>
          <Field label="Nome">
            <Input value={name} onChange={(e) => { setName(e.target.value); touch(); }} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Durata (min)">
              <Input
                type="number" min={5} step={5}
                value={durationMinutes}
                onChange={(e) => { setDurationMinutes(Math.max(5, numberOr(e.target.value, 30))); touch(); }}
              />
            </Field>
            <Field label="Assegnato a (userId separati da virgola)">
              <Input value={assignedTo} onChange={(e) => { setAssignedTo(e.target.value); touch(); }} />
            </Field>
          </div>
          <Field label="Messaggio di conferma">
            <Textarea rows={2} value={successMessage} onChange={(e) => { setSuccessMessage(e.target.value); touch(); }} />
          </Field>
          <Field label="URL di redirect (opzionale)">
            <Input value={redirectUrl} onChange={(e) => { setRedirectUrl(e.target.value); touch(); }} placeholder="https://…" />
          </Field>

          <Field label="Link pubblico">
            <div className="flex items-center gap-1">
              <Input readOnly value={directLink} className="font-mono text-xs" />
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 cursor-pointer" onClick={() => copy(directLink)} title="Copia">
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </div>
            {status !== "active" && (
              <p className="text-[11px] text-amber-600">Attiva il link per renderlo pubblico.</p>
            )}
          </Field>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <h2 className="text-sm font-semibold">Appuntamenti ricevuti</h2>
          <p className="text-[11px] text-muted-foreground">Orari visualizzati in UTC.</p>
        </div>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun appuntamento ricevuto.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Data</th>
                  <th className="px-2 py-2 font-medium">Ospite</th>
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id} className="border-b last:border-b-0">
                    <td className="whitespace-nowrap px-2 py-2">{formatAppointmentDate(appointment.startAt)}</td>
                    <td className="px-2 py-2">{appointment.guestName}</td>
                    <td className="px-2 py-2 text-muted-foreground">{appointment.guestEmail}</td>
                    <td className="px-2 py-2 capitalize">{appointment.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
