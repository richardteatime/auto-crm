"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Package, Pencil, Plus, ShieldCheck, Trash2, Video } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { eur, type VdPackage } from "@/lib/vendiora/types";
import { api, Field, Pill, inputCls, textareaCls, parseEuro, euroInput } from "./ui";

const TEMPLATE: Partial<VdPackage> = {
  name: "Store Shopify in 7 giorni + coach 90 giorni",
  tagline: "Store pronto a vendere in 7 giorni e affiancamento per 90 giorni",
  deliverables: [
    "Ricerca e scelta del prodotto insieme al cliente",
    "Store Shopify completo: tema, pagine prodotto, pagine legali, pagamenti e spedizioni",
    "Collegamento dei fornitori e degli ordini",
    "Impostazione del pixel e della prima campagna pubblicitaria",
    "Call individuali di affiancamento",
    "Supporto via chat nei giorni lavorativi",
  ].join("\n"),
  includedCalls: 12,
  buildDays: 7,
  coachingDays: 90,
  vatRate: 22,
};

export function PackagesManager() {
  const [items, setItems] = useState<VdPackage[] | null>(null);
  const [edit, setEdit] = useState<Partial<VdPackage> | null>(null);
  const load = useCallback(() => api<{ packages: VdPackage[] }>("/api/vendiora/packages").then((r) => setItems(r.packages)).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function remove(p: VdPackage) {
    if (!confirm(`Eliminare «${p.name}»? I clienti che l'hanno già comprato mantengono il loro contratto.`)) return;
    try { await api(`/api/vendiora/packages/${p.id}`, { method: "DELETE" }); toast.success("Pacchetto eliminato"); load(); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pacchetti"
        description="Quello che vendete. Il pacchetto scelto alla vendita genera il contratto e crea le call incluse."
        actions={<Button onClick={() => setEdit(items?.length ? { vatRate: 22, includedCalls: 0, buildDays: 7, coachingDays: 90 } : TEMPLATE)}><Plus /> Nuovo pacchetto</Button>}
      />
      {!items && <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>}
      {items && items.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Package className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">Nessun pacchetto</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Parti dal pacchetto della landing (store in 7 giorni + 90 giorni di coach): è precompilato, devi solo mettere il prezzo.</p>
          <Button className="mt-4" onClick={() => setEdit(TEMPLATE)}><Plus /> Crea dal modello</Button>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <article key={p.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold leading-snug">{p.name}</h3>
                  {p.tagline && <p className="mt-0.5 text-[13px] text-muted-foreground">{p.tagline}</p>}
                </div>
                {!p.active && <Pill tone="bg-muted text-muted-foreground ring-border">Non in vendita</Pill>}
              </div>
              <p className="mt-4 text-2xl font-extrabold tabular-nums tracking-tight">
                {p.price == null ? <span className="text-base font-semibold text-amber-600">Prezzo da inserire</span> : <>{eur(p.price)} <span className="text-xs font-medium text-muted-foreground">+ IVA {p.vatRate}%</span></>}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill tone="bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300"><Video className="size-3" />{p.includedCalls} call</Pill>
                <Pill tone="bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300"><Clock className="size-3" />store in {p.buildDays} g</Pill>
                {p.coachingDays > 0 && <Pill tone="bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300">coach {p.coachingDays} g</Pill>}
                {p.guarantee && <Pill tone="bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300"><ShieldCheck className="size-3" />garanzia</Pill>}
              </div>
              {p.deliverables && (
                <ul className="mt-4 flex-1 space-y-1 text-[13px] text-muted-foreground">
                  {p.deliverables.split("\n").filter(Boolean).slice(0, 6).map((l, i) => <li key={i} className="flex gap-2"><span className="text-orange-500">•</span>{l.replace(/^[-•*]\s*/, "")}</li>)}
                </ul>
              )}
              <div className="mt-4 flex gap-2 border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => setEdit(p)}><Pencil /> Modifica</Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => remove(p)}><Trash2 /> Elimina</Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <PackageDialog value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
    </div>
  );
}

function PackageDialog({ value, onClose, onSaved }: { value: Partial<VdPackage> | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<VdPackage>>({});
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (value) { setF(value); setPrice(euroInput(value.price)); } }, [value]);
  const set = <K extends keyof VdPackage>(k: K, v: VdPackage[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cents = price.trim() ? parseEuro(price) : null;
    if (price.trim() && cents == null) return toast.error("Prezzo non valido");
    setBusy(true);
    try {
      const body = { ...f, price: cents };
      if (f.id) await api(`/api/vendiora/packages/${f.id}`, { method: "PUT", json: body });
      else await api("/api/vendiora/packages", { json: body });
      toast.success("Pacchetto salvato");
      onSaved();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{f.id ? "Modifica pacchetto" : "Nuovo pacchetto"}</DialogTitle>
          <DialogDescription>Questi testi finiscono pari pari nel contratto: scrivi solo quello che vendete davvero.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nome"><input className={inputCls} required value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Frase breve"><input className={inputCls} value={f.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Prezzo (€, IVA esclusa)" className="sm:col-span-2"><input className={inputCls} inputMode="decimal" placeholder="es. 1.997" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            <Field label="IVA %"><input className={inputCls} type="number" min={0} max={100} value={f.vatRate ?? 22} onChange={(e) => set("vatRate", Number(e.target.value))} /></Field>
            <Field label="Call incluse"><input className={inputCls} type="number" min={0} max={200} value={f.includedCalls ?? 0} onChange={(e) => set("includedCalls", Number(e.target.value))} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Giorni per mettere online lo store" hint="Dal kick-off. È il termine della garanzia."><input className={inputCls} type="number" min={1} value={f.buildDays ?? 7} onChange={(e) => set("buildDays", Number(e.target.value))} /></Field>
            <Field label="Giorni di affiancamento" hint="Entro quando vanno usate le call."><input className={inputCls} type="number" min={0} value={f.coachingDays ?? 90} onChange={(e) => set("coachingDays", Number(e.target.value))} /></Field>
          </div>
          <Field label="Cosa è incluso" hint="Una voce per riga: diventa l'elenco dell'art. 1 del contratto."><textarea className={textareaCls + " min-h-[140px]"} value={f.deliverables ?? ""} onChange={(e) => set("deliverables", e.target.value)} /></Field>
          <Field label="Garanzia" hint="Cosa succede se lo store non è online nei tempi (es. rimborso, lavoro gratis fino a consegna). Se vuoto il contratto lo segna da inserire."><textarea className={textareaCls} value={f.guarantee ?? ""} onChange={(e) => set("guarantee", e.target.value)} /></Field>
          <Field label="Modalità di pagamento" hint="Es. «50% alla firma, 50% alla consegna dello store, con bonifico»."><textarea className={textareaCls} value={f.paymentTerms ?? ""} onChange={(e) => set("paymentTerms", e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active !== false} onChange={(e) => set("active", e.target.checked)} /> In vendita</label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Annulla</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvo…" : "Salva"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
