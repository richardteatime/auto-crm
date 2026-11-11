"use client";

import { useEffect, useState } from "react";
import { Bot, CalendarCheck, Euro, FileSignature, FileText, MessageCircle, Phone, Rocket, StickyNote, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, fmtDate } from "./ui";

type Item = { at: string; kind: string; title: string; detail?: string };
const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  lead: UserPlus, bot: Bot, offer: FileText, contract: FileSignature, pay: Euro, call: Phone, auto: MessageCircle, store: Rocket, note: StickyNote,
};
const DOT: Record<string, string> = {
  lead: "bg-sky-500", bot: "bg-violet-500", offer: "bg-orange-500", contract: "bg-emerald-600", pay: "bg-emerald-500",
  call: "bg-primary", auto: "bg-green-500", store: "bg-amber-500", note: "bg-muted-foreground/60",
};

/** Customer journey of one lead / client, newest first */
export function JourneyTimeline({ leadId, clientId, refreshKey = 0, max = 30 }: { leadId?: string | null; clientId?: string | null; refreshKey?: number; max?: number }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [all, setAll] = useState(false);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    const q = clientId ? `clientId=${clientId}` : `leadId=${leadId}`;
    api<{ items: Item[] }>(`/api/vendiora/journey?${q}`).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [leadId, clientId, refreshKey]);
  if (!items) return <p className="text-sm text-muted-foreground">…</p>;
  if (!items.length) return <p className="text-sm text-muted-foreground">Ancora nessun passaggio.</p>;
  const shown = all ? items : items.slice(0, max);
  return (
    <div>
      <ol className="relative space-y-3 border-l pl-5">
        {shown.map((it, i) => {
          const Icon = ICON[it.kind] ?? CalendarCheck;
          const future = Date.parse(it.at) > now;
          return (
            <li key={i} className="relative">
              <span className={cn("absolute -left-[27px] top-0.5 grid size-[14px] place-items-center rounded-full ring-4 ring-card", DOT[it.kind] ?? "bg-muted-foreground")} />
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className={cn("text-[13px] font-semibold leading-snug", future && "text-primary")}>{it.title}</p>
                  {it.detail && <p className="whitespace-pre-wrap break-words text-[12.5px] text-muted-foreground">{it.detail}</p>}
                  <p className="text-[11.5px] text-muted-foreground/80">{future ? "in programma · " : ""}{fmtDate(it.at, true)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {items.length > max && !all && <button className="mt-3 text-[12.5px] font-medium text-primary hover:underline" onClick={() => setAll(true)}>Mostra tutti ({items.length})</button>}
    </div>
  );
}
