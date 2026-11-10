"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileSignature, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLIENT_STATUS_CONFIG, eur, type VdClient } from "@/lib/vendiora/types";
import type { Lead } from "@/lib/leads/types";
import { api, Pill } from "./ui";
import { SellDialog } from "./SellDialog";

/** On the lead page: "Ha comprato" → package, contract, calls. Shows the client once sold. */
export function LeadPackageCard({ lead }: { lead: Lead }) {
  const [client, setClient] = useState<VdClient | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => { api<{ client: VdClient | null }>(`/api/vendiora/clients?leadId=${lead.id}`).then((r) => setClient(r.client)).catch(() => setClient(null)); }, [lead.id]);

  return (
    <section className="rounded-xl border border-orange-500/30 bg-card shadow-card">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <ShoppingBag className="size-4 text-orange-500" />
        <h2 className="text-sm font-semibold">Pacchetto Vendiora</h2>
      </header>
      <div className="p-4">
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
            <p className="mb-3 text-[13px] text-muted-foreground">Quando il lead compra, scegli il pacchetto: si crea il contratto con le sue condizioni e le call incluse.</p>
            <Button className="w-full bg-orange-500 text-white hover:bg-orange-600" onClick={() => setOpen(true)}><ShoppingBag /> Ha comprato</Button>
          </>
        )}
      </div>
      <SellDialog open={open} onOpenChange={setOpen} prefill={{ leadId: lead.id, name: lead.name, email: lead.email, phone: lead.phone }} />
    </section>
  );
}
