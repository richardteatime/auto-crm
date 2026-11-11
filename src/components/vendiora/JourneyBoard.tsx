"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "./ui";

type Stage = { key: string; label: string; hint: string };
type Card = { stage: string; leadId: string | null; clientId: string | null; name: string; detail: string; since: string; href: string };

const TONE: Record<string, string> = {
  nuovo: "bg-sky-500", bot: "bg-violet-500", qualificato: "bg-amber-500", offerta: "bg-orange-500", accettata: "bg-emerald-500",
  onboarding: "bg-sky-600", costruzione: "bg-amber-600", affiancamento: "bg-emerald-600", concluso: "bg-muted-foreground",
};

/** Vendiora: every lead and client in its stage, from first contact to end of coaching */
export function JourneyBoard() {
  const [data, setData] = useState<{ stages: Stage[]; cards: Card[]; lost: number } | null>(null);
  useEffect(() => { api<{ stages: Stage[]; cards: Card[]; lost: number }>("/api/vendiora/journey").then(setData).catch((e) => toast.error(e.message)); }, []);

  if (!data) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="flex gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-96 w-64 rounded-xl" />)}</div></div>;
  const total = data.cards.length;
  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Percorso clienti"
        description={`Dove si trova ogni persona, dal primo messaggio alla fine dell'affiancamento. ${total} in corso${data.lost ? ` · ${data.lost} persi o sospesi non mostrati` : ""}. Lead degli ultimi 120 giorni.`}
      />
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3">
        {data.stages.map((s, i) => {
          const cards = data.cards.filter((c) => c.stage === s.key);
          return (
            <section key={s.key} className="flex w-[264px] shrink-0 snap-start flex-col rounded-xl border bg-muted/30">
              <header className="border-b px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", TONE[s.key])} />
                  <h2 className="text-[13px] font-bold">{s.label}</h2>
                  <span className="ml-auto rounded-full bg-background px-2 text-[12px] font-semibold tabular-nums ring-1 ring-border">{cards.length}</span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">{i < 5 ? "Lead · " : "Cliente · "}{s.hint}</p>
              </header>
              <div className="flex max-h-[68vh] flex-col gap-2 overflow-y-auto p-2">
                {cards.length === 0 && <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">Nessuno</p>}
                {cards.map((c) => (
                  <Link key={(c.clientId ?? "") + (c.leadId ?? "")} href={c.href} className="rounded-lg border bg-card p-2.5 shadow-card transition-colors hover:border-orange-500/50">
                    <p className="truncate text-[13px] font-semibold">{c.name}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{c.detail}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">{c.since}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
