"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Video } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Segmented } from "@/components/shared/Segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CALL_STATUS_CONFIG, type ClientStatus, type VdCall } from "@/lib/vendiora/types";
import { api, Pill, fmtDate } from "./ui";

type Row = VdCall & { clientStatus: ClientStatus; coach: string | null };
type View = "prossime" | "da_prenotare" | "fatte";

export function CallsBoard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [view, setView] = useState<View>("prossime");
  const [now] = useState(() => Date.now());
  const load = useCallback(() => api<{ calls: Row[] }>("/api/vendiora/calls").then((r) => setRows(r.calls)).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const all = (rows ?? []).filter((c) => c.clientStatus !== "sospeso");
    const prossime = all.filter((c) => c.status === "prenotata").sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
    // to book: only the first open call of every active client
    const seen = new Set<string>();
    const da = all.filter((c) => c.status === "da_prenotare" && ["onboarding", "costruzione", "affiancamento"].includes(c.clientStatus))
      .sort((a, b) => a.number - b.number).filter((c) => (seen.has(c.clientId) ? false : (seen.add(c.clientId), true)));
    const fatte = all.filter((c) => c.status === "fatta").sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")).slice(0, 100);
    return { prossime, da_prenotare: da, fatte };
  }, [rows]);

  async function done(c: Row) {
    try { await api(`/api/vendiora/calls/${c.id}`, { method: "PUT", json: { status: "fatta" } }); toast.success("Call segnata come fatta"); load(); } catch (e) { toast.error((e as Error).message); }
  }

  const list = groups[view];
  return (
    <div className="space-y-5">
      <PageHeader title="Call" description="Le call di affiancamento di tutti i clienti. Data e note si gestiscono dalla scheda del cliente." />
      <Segmented label="Vista" value={view} onChange={setView} options={[
        { value: "prossime", label: `In calendario · ${groups.prossime.length}` },
        { value: "da_prenotare", label: `Da prenotare · ${groups.da_prenotare.length}` },
        { value: "fatte", label: "Fatte" },
      ]} />
      {!rows && <Skeleton className="h-64 rounded-xl" />}
      {rows && list.length === 0 && <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground"><Video className="mx-auto mb-2 size-7" />Niente qui.</div>}
      {list.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card shadow-card">
          {list.map((c) => {
            const late = c.status === "prenotata" && c.scheduledAt && Date.parse(c.scheduledAt) < now - 3600_000;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-36 shrink-0 text-sm tabular-nums">{c.status === "fatta" ? fmtDate(c.doneAt) : c.scheduledAt ? fmtDate(c.scheduledAt, true) : "—"}</span>
                <Link href={`/vendiora/clienti/${c.clientId}`} className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold hover:text-orange-600">{c.clientName}</span><span className="text-xs text-muted-foreground">{c.title} · n. {c.number}{c.coach ? ` · ${c.coach}` : ""}</span></Link>
                {late ? <Pill tone="bg-amber-500/10 text-amber-700 ring-amber-500/25">Passata: com&apos;è andata?</Pill> : <Pill tone={CALL_STATUS_CONFIG[c.status].tone}>{CALL_STATUS_CONFIG[c.status].label}</Pill>}
                {c.status === "prenotata" && <Button size="sm" variant="outline" onClick={() => done(c)}>Fatta</Button>}
                {c.status === "da_prenotare" && <Link href={`/vendiora/clienti/${c.clientId}`} className="text-sm font-semibold text-orange-600 hover:underline">Fissa data</Link>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
