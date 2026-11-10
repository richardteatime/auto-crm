"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, UserRoundCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Segmented } from "@/components/shared/Segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CLIENT_STATUSES, CLIENT_STATUS_CONFIG, eur, guaranteeDeadline, type ClientStatus, type VdClient } from "@/lib/vendiora/types";
import { api, Pill, fmtDate, inputCls } from "./ui";
import { SellDialog } from "./SellDialog";

type Row = VdClient & { calls: { done: number; total: number; next: string | null } };

export function ClientsList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<"attivi" | ClientStatus | "tutti">("attivi");
  const [q, setQ] = useState("");
  const [sell, setSell] = useState(false);
  const [now] = useState(() => Date.now());
  useEffect(() => { api<{ clients: Row[] }>("/api/vendiora/clients").then((r) => setRows(r.clients)).catch((e) => toast.error(e.message)); }, []);

  const shown = useMemo(() => (rows ?? []).filter((c) => {
    if (filter === "attivi" && !["onboarding", "costruzione", "affiancamento"].includes(c.status)) return false;
    if (filter !== "attivi" && filter !== "tutti" && c.status !== filter) return false;
    const s = q.trim().toLowerCase();
    return !s || [c.name, c.email, c.phone, c.contractNumber, c.packageName].some((x) => x?.toLowerCase().includes(s));
  }), [rows, filter, q]);

  const count = (st: string) => (rows ?? []).filter((c) => (st === "attivi" ? ["onboarding", "costruzione", "affiancamento"].includes(c.status) : st === "tutti" || c.status === st)).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Clienti" description="Chi ha comprato un pacchetto: contratto, pagamento, store e call." actions={<Button onClick={() => setSell(true)}><Plus /> Nuovo cliente</Button>} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="overflow-x-auto">
          <Segmented
            label="Filtra clienti"
            value={filter as string}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: "attivi", label: `Attivi · ${count("attivi")}` },
              ...CLIENT_STATUSES.map((s) => ({ value: s, label: `${CLIENT_STATUS_CONFIG[s].label} · ${count(s)}` })),
              { value: "tutti", label: "Tutti" },
            ]}
          />
        </div>
        <div className="relative lg:w-72"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input className={inputCls + " pl-9"} placeholder="Cerca cliente o contratto" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {!rows && <Skeleton className="h-64 rounded-xl" />}
      {rows && shown.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <UserRoundCheck className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">{rows.length ? "Nessun cliente con questo filtro" : "Ancora nessun cliente"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Dalla scheda di un lead premi «Ha comprato», oppure crea qui il cliente.</p>
        </div>
      )}
      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-[12px] font-semibold text-muted-foreground">
              <tr><th className="px-4 py-2.5">Cliente</th><th className="px-3">Pacchetto</th><th className="px-3">Stato</th><th className="px-3">Store</th><th className="px-3">Call</th><th className="px-3 text-right">Prezzo</th><th className="px-4">Pagato</th></tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((c) => {
                const dl = c.status === "costruzione" ? guaranteeDeadline(c) : null;
                const left = dl ? Math.ceil((dl.getTime() - now) / 86_400_000) : null;
                return (
                  <tr key={c.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3"><Link href={`/vendiora/clienti/${c.id}`} className="font-semibold hover:text-orange-600">{c.name}</Link><div className="text-xs text-muted-foreground">{c.contractNumber} · {fmtDate(c.contractDate)}</div></td>
                    <td className="px-3 text-[13px]">{c.packageName}</td>
                    <td className="px-3"><Pill tone={CLIENT_STATUS_CONFIG[c.status].tone}>{CLIENT_STATUS_CONFIG[c.status].label}</Pill></td>
                    <td className="px-3 text-[13px]">
                      {c.storeLiveAt ? <span className="text-emerald-600">Online dal {fmtDate(c.storeLiveAt)}</span>
                        : left != null ? <span className={left < 0 ? "font-semibold text-rose-600" : left <= 2 ? "font-semibold text-amber-600" : ""}>{left < 0 ? `Garanzia scaduta (${-left} g)` : `${left} g alla consegna`}</span>
                        : <span className="text-muted-foreground">{c.kickoffAt ? "—" : "Kick-off da fare"}</span>}
                    </td>
                    <td className="px-3 text-[13px] tabular-nums">{c.calls.done}/{c.calls.total}{c.calls.next && <div className="text-xs text-muted-foreground">prossima {fmtDate(c.calls.next, true)}</div>}</td>
                    <td className="px-3 text-right font-semibold tabular-nums">{eur(c.price)}</td>
                    <td className="px-4">{c.isPaid ? <Pill tone="bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300">Pagato</Pill> : <Pill tone="bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300">Da incassare</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <SellDialog open={sell} onOpenChange={setSell} />
    </div>
  );
}
