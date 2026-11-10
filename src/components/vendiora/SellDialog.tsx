"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { eur, type VdPackage } from "@/lib/vendiora/types";
import { api, Field, inputCls, textareaCls, parseEuro, euroInput } from "./ui";

export interface SellPrefill { leadId?: string; name?: string; email?: string | null; phone?: string | null }

/** "Ha comprato": choose the package → client + contract + included calls (+ won lead and deal in Finance) */
export function SellDialog({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (o: boolean) => void; prefill?: SellPrefill }) {
  const router = useRouter();
  const [pkgs, setPkgs] = useState<VdPackage[] | null>(null);
  const [pkgId, setPkgId] = useState("");
  const [price, setPrice] = useState("");
  const [f, setF] = useState({ name: "", email: "", phone: "", taxId: "", address: "", notes: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({ name: prefill?.name ?? "", email: prefill?.email ?? "", phone: prefill?.phone ?? "", taxId: "", address: "", notes: "" });
    api<{ packages: VdPackage[] }>("/api/vendiora/packages").then((r) => {
      const act = r.packages.filter((p) => p.active);
      setPkgs(act);
      if (act[0]) { setPkgId(act[0].id); setPrice(euroInput(act[0].price)); }
    }).catch((e) => toast.error(e.message));
  }, [open, prefill]);

  const pkg = pkgs?.find((p) => p.id === pkgId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseEuro(price);
    if (cents == null) return toast.error("Inserisci il prezzo di vendita");
    setBusy(true);
    try {
      const r = await api<{ client: { id: string; contractNumber: string } }>("/api/vendiora/clients", { json: { ...f, leadId: prefill?.leadId, packageId: pkgId, price: cents } });
      toast.success(`Cliente creato · contratto ${r.client.contractNumber}`);
      onOpenChange(false);
      router.push(`/vendiora/clienti/${r.client.id}`);
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ha comprato un pacchetto</DialogTitle>
          <DialogDescription>Crea il cliente, il contratto e le call incluse.{prefill?.leadId ? " Il lead passa a «Vinto» e la trattativa va in Finance." : ""}</DialogDescription>
        </DialogHeader>
        {pkgs && pkgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Prima crea un pacchetto in <a className="font-semibold text-orange-600 underline" href="/vendiora/pacchetti">Pacchetti</a>.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Pacchetto">
              <div className="grid gap-2">
                {(pkgs ?? []).map((p) => (
                  <label key={p.id} className={"flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors " + (p.id === pkgId ? "border-orange-500 bg-orange-500/[0.06]" : "hover:bg-accent")}>
                    <input type="radio" name="pkg" className="accent-orange-500" checked={p.id === pkgId} onChange={() => { setPkgId(p.id); setPrice(euroInput(p.price)); }} />
                    <span className="flex-1"><b>{p.name}</b><span className="block text-xs text-muted-foreground">{p.includedCalls} call · store in {p.buildDays} giorni</span></span>
                    <span className="font-semibold tabular-nums">{eur(p.price)}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Prezzo di vendita (€, IVA esclusa)" hint={pkg?.price != null && parseEuro(price) !== pkg.price ? `Listino ${eur(pkg.price)}` : undefined}>
              <input className={inputCls} inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome e cognome / ragione sociale" className="sm:col-span-2"><input className={inputCls} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Telefono"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
              <Field label="Codice fiscale / P.IVA"><input className={inputCls} value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} /></Field>
              <Field label="Indirizzo"><input className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
            </div>
            <Field label="Note"><textarea className={textareaCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
              <Button type="submit" disabled={busy || !pkgId}>{busy ? "Creo…" : "Crea cliente e contratto"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
