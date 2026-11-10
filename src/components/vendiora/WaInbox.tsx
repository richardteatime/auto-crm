"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BOT_STATE_LABELS, type BotState } from "@/lib/vendiora/types";
import { LEAD_STATUS_CONFIG, type LeadStatus } from "@/lib/leads/types";
import { api, Panel, fmtDate, inputCls } from "./ui";
import { WaChat } from "./WaChat";
import { WaConnection } from "./WaConnection";

interface Row { leadId: string; name: string; phone: string | null; status: string; state: BotState | null; lastText: string | null; lastAt: string | null; lastDir: string | null; unanswered: boolean }

export function WaInbox() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState(false);
  const load = useCallback(() => api<{ chats: Row[] }>("/api/vendiora/inbox").then((r) => setRows(r.chats)).catch(() => setRows((x) => x ?? [])), []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const shown = (rows ?? []).filter((r) => (!only || r.unanswered) && (!q.trim() || `${r.name} ${r.phone}`.toLowerCase().includes(q.trim().toLowerCase())));
  const current = rows?.find((r) => r.leadId === sel) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader title="WhatsApp" description="Tutte le chat con i lead: quelle del bot e quelle scritte a mano, dal CRM o dal telefono." />
      <Panel><WaConnection compact /></Panel>
      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col rounded-xl border bg-card shadow-card">
          <div className="space-y-2 border-b p-3">
            <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input className={inputCls + " pl-9"} placeholder="Cerca" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Solo chi aspetta una risposta</label>
          </div>
          <ul className="max-h-[640px] flex-1 divide-y overflow-y-auto">
            {!rows && Array.from({ length: 6 }).map((_, i) => <li key={i} className="p-3"><Skeleton className="h-10" /></li>)}
            {rows && shown.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nessuna chat.</li>}
            {shown.map((r) => (
              <li key={r.leadId}>
                <button type="button" onClick={() => setSel(r.leadId)} className={cn("flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-accent/60", sel === r.leadId && "bg-accent")}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-700">{r.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{r.name}</span><span className="shrink-0 text-[11px] text-muted-foreground">{r.lastAt ? fmtDate(r.lastAt, true) : ""}</span></span>
                    <span className="flex items-center gap-2"><span className={cn("truncate text-[12.5px]", r.unanswered ? "font-semibold text-foreground" : "text-muted-foreground")}>{r.lastDir === "out" ? "Tu: " : ""}{r.lastText ?? (r.state ? BOT_STATE_LABELS[r.state] : "")}</span>{r.unanswered && <span className="ml-auto size-2 shrink-0 rounded-full bg-emerald-500" />}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          {current ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-bold">{current.name}</p><p className="text-xs text-muted-foreground">{current.phone} · {LEAD_STATUS_CONFIG[current.status as LeadStatus]?.label ?? current.status}</p></div>
                <Link href={`/leads/${current.leadId}`} className="text-sm font-semibold text-orange-600 hover:underline">Scheda lead →</Link>
              </div>
              <WaChat key={current.leadId} leadId={current.leadId} height="h-[460px]" />
            </>
          ) : (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center text-muted-foreground">
              <MessageCircle className="size-8" />
              <p className="mt-2 text-sm">Scegli una chat a sinistra.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
