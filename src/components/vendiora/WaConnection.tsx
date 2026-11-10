"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, LogOut, QrCode, Smartphone, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "./ui";

interface WaStatus { status: string; reason: string | null; phone: string | null; qr: string | null }

export function WaConnection({ compact = false }: { compact?: boolean }) {
  const [s, setS] = useState<WaStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<WaStatus>("/api/vendiora/wa/status").then(setS).catch(() => setS({ status: "unreachable", reason: null, phone: null, qr: null })), []);
  useEffect(() => {
    load();
    const t = setInterval(load, s?.status === "qr" || s?.status === "connecting" || s?.status === "reconnecting" ? 3000 : 15000);
    return () => clearInterval(t);
  }, [load, s?.status]);

  async function act(a: "connect" | "logout") {
    if (a === "logout" && !confirm("Scollegare WhatsApp? Il bot smette di scrivere finché non scansionate di nuovo il QR.")) return;
    setBusy(true);
    try { setS(await api<WaStatus>(`/api/vendiora/wa/${a}`, { method: "POST" })); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (!s) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Controllo WhatsApp…</div>;

  if (s.status === "not_configured" || s.status === "unreachable") {
    return (
      <div className="flex items-start gap-3 text-sm">
        <WifiOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-semibold">{s.status === "not_configured" ? "Servizio WhatsApp non ancora attivo" : "Servizio WhatsApp non raggiungibile"}</p>
          <p className="text-muted-foreground">{s.status === "not_configured" ? "Va acceso il servizio wa-gateway sul server (lo fa il tecnico una volta sola)." : "Riprova tra un minuto; se continua, il servizio sul server è fermo."}</p>
        </div>
      </div>
    );
  }
  if (s.status === "connected") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-5 text-emerald-500" /> Collegato{s.phone ? ` al numero +${s.phone}` : ""}</p>
        {!compact && <Button variant="outline" size="sm" disabled={busy} onClick={() => act("logout")}><LogOut /> Scollega</Button>}
      </div>
    );
  }
  if (s.status === "qr" && s.qr) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.qr} alt="QR WhatsApp" className="size-56 rounded-lg border bg-white p-2" />
        <ol className="space-y-1.5 text-sm">
          <li className="flex gap-2"><Smartphone className="size-4 shrink-0 text-muted-foreground" /> Prendi il telefono con il numero di VendiOra</li>
          <li>1. Apri WhatsApp → <b>Impostazioni</b> → <b>Dispositivi collegati</b></li>
          <li>2. Tocca <b>Collega un dispositivo</b></li>
          <li>3. Inquadra questo codice (si aggiorna da solo)</li>
        </ol>
      </div>
    );
  }
  if (s.status === "connecting" || s.status === "reconnecting" || (s.status === "qr" && !s.qr)) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {s.status === "reconnecting" ? "Mi ricollego…" : "Preparo il codice QR…"}</p>;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{s.status === "logged_out" ? "Il telefono ha scollegato questo dispositivo." : "WhatsApp non è collegato."}</p>
      <Button size="sm" disabled={busy} onClick={() => act("connect")}><QrCode /> Collega con QR</Button>
    </div>
  );
}
