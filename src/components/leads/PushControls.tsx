"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BellRing, BellOff, Loader2, Smartphone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "server-off";

function b64ToUint8(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** Web push on this device: new leads, uncalled-lead alerts, due call-backs */
export function usePush() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      return;
    }
    const cfg = await fetch("/api/push").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!cfg?.configured || !cfg.publicKey) {
      setState("server-off");
      return;
    }
    setPublicKey(cfg.publicKey);
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      // Keep the server in sync with this device (idempotent upsert)
      fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      }).catch(() => {});
    }
    setState(sub ? "on" : "off");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        toast.error("Permesso per le notifiche non concesso");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error();
      setState("on");
      toast.success("Notifiche attive su questo dispositivo");
      await fetch("/api/push/test", { method: "POST" }).catch(() => {});
    } catch {
      toast.error("Non sono riuscito ad attivare le notifiche");
    } finally {
      setBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Notifiche disattivate su questo dispositivo");
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(async () => {
    const r = await fetch("/api/push/test", { method: "POST" }).then((x) => x.json()).catch(() => null);
    if (r?.sent) toast.success("Notifica di prova inviata");
    else toast.error("Nessun dispositivo ha ricevuto la notifica");
  }, []);

  return { state, busy, enable, disable, test };
}

/** Full card for Settings */
export function PushCard({ className }: { className?: string }) {
  const { state, busy, enable, disable, test } = usePush();
  return (
    <section className={cn("rounded-xl border bg-card p-4 shadow-card", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BellRing className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-semibold">Avvisi dei nuovi lead</h2>
          <p className="text-sm text-muted-foreground">
            Una notifica sul telefono appena arriva un lead, quando un lead aspetta troppo e quando è ora di richiamare.
          </p>
          <PushStatus state={state} />
          <div className="flex flex-wrap gap-2 pt-2">
            {state === "off" && (
              <Button onClick={enable} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <BellRing />}
                Attiva su questo dispositivo
              </Button>
            )}
            {state === "on" && (
              <>
                <Button variant="outline" onClick={test}>
                  <Send />
                  Invia una prova
                </Button>
                <Button variant="ghost" onClick={disable} disabled={busy}>
                  <BellOff />
                  Disattiva
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PushStatus({ state }: { state: State }) {
  if (state === "loading") return <p className="text-xs text-muted-foreground">Controllo…</p>;
  if (state === "on") return <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Attive su questo dispositivo</p>;
  if (state === "off") return <p className="text-xs text-muted-foreground">Non attive su questo dispositivo</p>;
  if (state === "denied")
    return (
      <p className="text-xs text-rose-600 dark:text-rose-400">
        Le notifiche sono bloccate: riattivale dalle impostazioni del browser (o del telefono) per questo sito.
      </p>
    );
  if (state === "server-off") return <p className="text-xs text-muted-foreground">Le notifiche non sono ancora configurate sul server.</p>;
  if (state === "ios-install")
    return (
      <div className="mt-1 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
        <p className="mb-1 flex items-center gap-1.5 font-semibold">
          <Smartphone className="size-3.5" /> Su iPhone serve un passaggio in più
        </p>
        In Safari tocca <strong>Condividi</strong> → <strong>Aggiungi alla schermata Home</strong>. Poi apri SarconX dall&apos;icona sulla
        Home, entra qui in Impostazioni e attiva le notifiche.
      </div>
    );
  return <p className="text-xs text-muted-foreground">Questo browser non supporta le notifiche push.</p>;
}

/** Compact nudge for the Lead page when notifications are off on this device */
export function PushNudge() {
  const { state, busy, enable } = usePush();
  const dismissedStored = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => localStorage.getItem("leads-push-nudge") === "dismissed",
    () => true
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  if (dismissedStored || dismissedNow || !(state === "off" || state === "ios-install")) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-3">
      <BellRing className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm">
        {state === "ios-install"
          ? "Aggiungi il CRM alla schermata Home (Safari → Condividi) per ricevere un avviso a ogni nuovo lead."
          : "Attiva le notifiche per sapere subito quando arriva un lead."}
      </p>
      {state === "off" && (
        <Button size="sm" onClick={enable} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Attiva
        </Button>
      )}
      <button
        type="button"
        onClick={() => {
          localStorage.setItem("leads-push-nudge", "dismissed");
          setDismissedNow(true);
        }}
        className="text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Non ora
      </button>
    </div>
  );
}
