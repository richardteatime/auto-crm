"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Eye, FileSignature, FileText, Loader2, Send, ShoppingBag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLIENT_STATUS_CONFIG, OFFER_STATUS_CONFIG, OPEN_OFFER, eur, type VdClient, type VdOffer, type VdPackage } from "@/lib/vendiora/types";
import type { Lead } from "@/lib/leads/types";
import { cleanPhoneForWhatsApp } from "@/lib/constants";
import { api, Field, Pill, fmtDate, inputCls, textareaCls, parseEuro, euroInput } from "./ui";
import { SellDialog } from "./SellDialog";
import { JourneyTimeline } from "./JourneyTimeline";

type Offer = VdOffer & { url: string; text: string };

/** On the lead page: Vendiora offer → "Ha comprato" (contract, calls) → client journey */
export function LeadPackageCard({ lead }: { lead: Lead }) {
  const [client, setClient] = useState<VdClient | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sellOpen, setSellOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    api<{ client: VdClient | null }>(`/api/vendiora/clients?leadId=${lead.id}`).then((r) => setClient(r.client)).catch(() => setClient(null));
    api<{ offers: Offer[] }>(`/api/vendiora/offers?leadId=${lead.id}`).then((r) => setOffers(r.offers)).catch(() => setOffers([]));
    setTick((t) => t + 1);
  }, [lead.id]);
  useEffect(load, [load]);

  const current = offers.find((o) => OPEN_OFFER.includes(o.status) || o.status === "accettata") ?? offers[0];

  async function send(o: Offer) {
    setBusy("send");
    try {
      await api(`/api/vendiora/offers/${o.id}`, { method: "PUT", json: { action: "send" } });
      toast.success("Offerta inviata su WhatsApp");
      load();
    } catch (e) {
      // Not connected: open WhatsApp with the same text, then mark it as sent by hand
      const phone = lead.phoneE164 || lead.phone;
      if (phone) {
        window.open(`https://wa.me/${cleanPhoneForWhatsApp(phone)}?text=${encodeURIComponent(o.text)}`, "_blank");
        await api(`/api/vendiora/offers/${o.id}`, { method: "PUT", json: { action: "mark_sent" } }).catch(() => {});
        toast.message("WhatsApp del CRM non collegato: ti ho aperto WhatsApp col messaggio pronto", { description: (e as Error).message });
        load();
      } else toast.error((e as Error).message);
    } finally { setBusy(null); }
  }

  async function setStatus(o: Offer, status: string) {
    setBusy(status);
    try { await api(`/api/vendiora/offers/${o.id}`, { method: "PUT", json: { status } }); load(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  async function remove(o: Offer) {
    if (!confirm(`Eliminare l'offerta ${o.number}?`)) return;
    try { await api(`/api/vendiora/offers/${o.id}`, { method: "DELETE" }); load(); } catch (e) { toast.error((e as Error).message); }
  }

  const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50";

  return (
    <section className="rounded-xl border border-orange-500/30 bg-card shadow-card">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <ShoppingBag className="size-4 text-orange-500" />
        <h2 className="text-sm font-semibold">Vendiora</h2>
      </header>
      <div className="space-y-4 p-4">
        {client === undefined ? <p className="text-sm text-muted-foreground">…</p> : client ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">{client.packageName}</p>
              <p className="text-[13px] text-muted-foreground">{eur(client.price)} + IVA · contratto {client.contractNumber}</p>
            </div>
            <Pill tone={CLIENT_STATUS_CONFIG[client.status].tone}>{CLIENT_STATUS_CONFIG[client.status].label}</Pill>
            <div className="flex flex-wrap gap-2">
              <Link href={`/vendiora/clienti/${client.id}`} className="inline-flex h-8 items-center rounded-lg border px-3 text-[13px] font-medium hover:bg-accent">Scheda cliente</Link>
              <a href={`/api/vendiora/clients/${client.id}/contract`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-orange-500 px-3 text-[13px] font-semibold text-white hover:bg-orange-600"><FileSignature className="size-3.5" /> Contratto</a>
            </div>
          </div>
        ) : (
          <>
            {current ? (
              <div className="space-y-2.5 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">Offerta {current.number}</p>
                    <p className="text-[12.5px] text-muted-foreground">{current.packageName} · {eur(current.price)} + IVA</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {current.sentAt ? `Inviata ${fmtDate(current.sentAt, true)}` : "Non ancora inviata"}{current.viewedAt ? ` · aperta ${fmtDate(current.viewedAt, true)}` : ""}{current.validUntil ? ` · valida fino al ${fmtDate(current.validUntil)}` : ""}
                    </p>
                  </div>
                  <Pill tone={OFFER_STATUS_CONFIG[current.status].tone}>{OFFER_STATUS_CONFIG[current.status].label}</Pill>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {current.status !== "accettata" && current.status !== "rifiutata" && (
                    <button className={`${btn} border-orange-500/40 bg-orange-500 text-white hover:bg-orange-600`} disabled={!!busy} onClick={() => send(current)}>
                      {busy === "send" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}{current.sentAt ? "Rimanda" : "Invia offerta"}
                    </button>
                  )}
                  <a className={btn} href={`${current.url}?anteprima=1`} target="_blank" rel="noreferrer"><Eye className="size-3.5" /> Vedi</a>
                  <button className={btn} onClick={() => { navigator.clipboard.writeText(current.url); toast.success("Link copiato"); }}><Copy className="size-3.5" /> Link</button>
                  {OPEN_OFFER.includes(current.status) && <button className={btn} disabled={!!busy} onClick={() => setStatus(current, "accettata")}><Check className="size-3.5" /> Ha accettato</button>}
                  {OPEN_OFFER.includes(current.status) && <button className={btn} disabled={!!busy} onClick={() => setStatus(current, "rifiutata")}><X className="size-3.5" /> Rifiutata</button>}
                  {!current.sentAt && <button className={btn} onClick={() => remove(current)}><Trash2 className="size-3.5" /></button>}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">Prepara l&apos;offerta col pacchetto giusto: il lead riceve su WhatsApp il link alla proposta VendiOra con il suo nome e può accettarla online.</p>
            )}
            <div className="grid gap-2">
              {(!current || current.status === "rifiutata" || current.status === "scaduta") && (
                <Button variant="outline" className="w-full" onClick={() => setOfferOpen(true)}><FileText /> {current ? "Nuova offerta" : "Prepara offerta"}</Button>
              )}
              <Button className="w-full bg-orange-500 text-white hover:bg-orange-600" onClick={() => setSellOpen(true)}><ShoppingBag /> Ha comprato</Button>
            </div>
          </>
        )}
        <div className="border-t pt-3">
          <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Percorso</p>
          <JourneyTimeline leadId={lead.id} refreshKey={tick} max={8} />
        </div>
      </div>
      <SellDialog
        open={sellOpen}
        onOpenChange={(o) => { setSellOpen(o); if (!o) load(); }}
        prefill={{ leadId: lead.id, name: lead.name, email: lead.email, phone: lead.phone, offerId: current && current.status !== "rifiutata" ? current.id : undefined, packageId: current?.packageId, price: current?.price }}
      />
      <OfferDialog open={offerOpen} onOpenChange={setOfferOpen} lead={lead} onCreated={(o) => { load(); setOfferOpen(false); send(o); }} />
    </section>
  );
}

function OfferDialog({ open, onOpenChange, lead, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; lead: Lead; onCreated: (o: Offer) => void }) {
  const [pkgs, setPkgs] = useState<VdPackage[] | null>(null);
  const [pkgId, setPkgId] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setMessage("");
    api<{ packages: VdPackage[] }>("/api/vendiora/packages").then((r) => {
      const act = r.packages.filter((p) => p.active);
      setPkgs(act);
      if (act[0]) { setPkgId(act[0].id); setPrice(euroInput(act[0].price)); }
    }).catch((e) => toast.error(e.message));
  }, [open]);

  async function create(sendNow: boolean) {
    const cents = parseEuro(price);
    if (cents == null) return toast.error("Inserisci il prezzo");
    setBusy(true);
    try {
      const r = await api<{ offer: Offer }>("/api/vendiora/offers", { json: { leadId: lead.id, packageId: pkgId, price: cents, message } });
      toast.success(`Offerta ${r.offer.number} pronta`);
      if (sendNow) onCreated(r.offer); else onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Offerta VendiOra per {lead.name}</DialogTitle>
          <DialogDescription>Scegli il pacchetto: si crea la proposta col suo nome, da inviare su WhatsApp. Quando la accetta te lo segnala il CRM.</DialogDescription>
        </DialogHeader>
        {pkgs && pkgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Prima crea un pacchetto in <Link className="text-primary underline" href="/vendiora/pacchetti">Vendiora → Pacchetti</Link>.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2">
              {(pkgs ?? []).map((p) => (
                <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${p.id === pkgId ? "border-orange-500 bg-orange-500/5" : ""}`}>
                  <input type="radio" name="opkg" className="accent-orange-500" checked={p.id === pkgId} onChange={() => { setPkgId(p.id); setPrice(euroInput(p.price)); }} />
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="font-semibold tabular-nums">{p.price != null ? eur(p.price) : "senza prezzo"}</span>
                </label>
              ))}
            </div>
            <Field label="Prezzo proposto (€, IVA esclusa)"><input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            <Field label="Messaggio personale (facoltativo)" hint="Compare in cima alla proposta, es. cosa vi siete detti in call.">
              <textarea className={textareaCls} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy || !pkgId} onClick={() => create(false)}>Salva senza inviare</Button>
              <Button className="bg-orange-500 text-white hover:bg-orange-600" disabled={busy || !pkgId} onClick={() => create(true)}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Crea e invia</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
