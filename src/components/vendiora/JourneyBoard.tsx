"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "./ui";

type Pipeline = "vendite" | "consulenza" | "dfy" | "upsell";
type Stage = { id: string; label: string; hint?: string };
type Card = { stage: string; leadId: string | null; clientId: string | null; name: string; detail: string; since: string; href: string; health?: "verde" | "giallo" | "rosso" | null; badges?: string[] };
type Data = { pipelines: { id: Pipeline; label: string; hint: string }[]; pipeline: Pipeline; stages: Stage[]; cards: Card[]; lost: number; counts: Record<Pipeline, number> };

const DOT: Record<string, string> = { verde: "bg-emerald-500", giallo: "bg-amber-500", rosso: "bg-rose-500" };
const colTone = (id: string) => (id === "PERSO" || id === "RIMB" ? "bg-rose-500" : id === "NURT" || id === "SOSP" ? "bg-muted-foreground" : id === "S7" || id === "O7" || id === "D8" || id === "U6" ? "bg-emerald-500" : "bg-orange-500");

/** VendiOra pipelines of the playbook: Vendite S1–S7, Consulenza O1–O7, Done For You D1–D8, Upsell U1–U6 */
export function JourneyBoard() {
  const [pipeline, setPipeline] = useState<Pipeline>("vendite");
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    api<Data>(`/api/vendiora/journey?pipeline=${pipeline}`).then(setData).catch((e) => toast.error(e.message));
  }, [pipeline]);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Pipeline"
        description={data ? `${data.pipelines.find((p) => p.id === pipeline)?.hint ?? ""} · ${data.cards.length} in corso${data.lost ? ` · ${data.lost} chiusi non mostrati` : ""}${pipeline === "vendite" ? " · lead degli ultimi 120 giorni" : ""}.` : "Le fasi del playbook, dal primo messaggio all'upsell."}
      />
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {(data?.pipelines ?? [{ id: "vendite", label: "Vendite (S)" }, { id: "consulenza", label: "Consulenza (O1–O7)" }, { id: "dfy", label: "Done For You (D1–D8)" }, { id: "upsell", label: "Upsell (U1–U6)" }] as { id: Pipeline; label: string }[]).map((p) => (
          <button key={p.id} role="tab" aria-selected={p.id === pipeline} type="button" onClick={() => { if (p.id !== pipeline) { setData(null); setPipeline(p.id); } }}
            className={cn("rounded-lg border px-3 py-1.5 text-[13px] font-semibold", p.id === pipeline ? "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300" : "hover:bg-accent")}>
            {p.label}{data?.counts ? <span className="ml-1.5 text-muted-foreground tabular-nums">{data.counts[p.id]}</span> : null}
          </button>
        ))}
      </div>
      {!data ? (
        <div className="flex gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-96 w-64 rounded-xl" />)}</div>
      ) : (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3">
          {data.stages.map((s) => {
            const cards = data.cards.filter((c) => c.stage === s.id);
            return (
              <section key={s.id} className="flex w-[248px] shrink-0 snap-start flex-col rounded-xl border bg-muted/30">
                <header className="border-b px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", colTone(s.id))} />
                    <h2 className="text-[13px] font-bold leading-tight">{s.label}</h2>
                    <span className="ml-auto rounded-full bg-background px-2 text-[12px] font-semibold tabular-nums ring-1 ring-border">{cards.length}</span>
                  </div>
                  {s.hint && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground" title={s.hint}>{s.hint}</p>}
                </header>
                <div className="flex max-h-[66vh] flex-col gap-2 overflow-y-auto p-2">
                  {cards.length === 0 && <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">Nessuno</p>}
                  {cards.map((c) => (
                    <Link key={(c.clientId ?? "") + (c.leadId ?? "")} href={c.href} className="rounded-lg border bg-card p-2.5 shadow-card transition-colors hover:border-orange-500/50">
                      <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold">{c.health && <span className={cn("size-2 shrink-0 rounded-full", DOT[c.health])} title={`Salute ${c.health}`} />}{c.name}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{c.detail}</p>
                      {c.badges?.length ? <div className="mt-1 flex flex-wrap gap-1">{c.badges.map((b) => <span key={b} className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] font-medium">{b}</span>)}</div> : null}
                      <p className="mt-1 text-[11px] text-muted-foreground/80">{c.since}</p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
