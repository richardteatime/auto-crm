"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { burstConfetti } from "@/lib/confetti";
import { cn } from "@/lib/utils";

interface StepStage {
  id: string;
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

/** Clickable stage path: move the deal forward (or mark it lost) without opening the kanban */
export function StageStepper({ dealId, stages, currentId }: { dealId: string; stages: StepStage[]; currentId: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(currentId);
  const [pending, setPending] = useState<string | null>(null);

  const path = stages.filter((s) => !s.isLost);
  const lost = stages.find((s) => s.isLost);
  const currentIndex = path.findIndex((s) => s.id === current);
  const isLostNow = lost?.id === current;

  async function moveTo(stage: StepStage, el?: HTMLElement | null) {
    if (stage.id === current || pending) return;
    setPending(stage.id);
    try {
      const res = await fetch("/api/pipeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, stageId: stage.id }),
      });
      if (!res.ok) throw new Error();
      setCurrent(stage.id);
      if (stage.isWon) {
        const r = el?.getBoundingClientRect();
        burstConfetti(r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 2 : undefined);
        toast.success("Trattativa vinta!", { icon: <Trophy className="size-4 text-emerald-500" /> });
      } else {
        toast(`Fase aggiornata: ${stage.name}`);
      }
      router.refresh();
    } catch {
      toast.error("Non sono riuscito ad aggiornare la fase");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <ol className="flex flex-1 items-stretch gap-1 overflow-x-auto scrollbar-none">
        {path.map((s, i) => {
          const done = !isLostNow && currentIndex >= 0 && i < currentIndex;
          const active = s.id === current;
          return (
            <li key={s.id} className="min-w-[92px] flex-1">
              <button
                type="button"
                onClick={(e) => moveTo(s, e.currentTarget)}
                disabled={!!pending}
                aria-current={active ? "step" : undefined}
                title={active ? `Fase attuale: ${s.name}` : `Sposta in ${s.name}`}
                className={cn(
                  "group flex h-9 w-full items-center justify-center gap-1.5 px-3 text-xs font-semibold transition-all",
                  // Chevron segments: the first has a flat left edge, the last a flat right edge
                  i === 0
                    ? "rounded-l-lg [clip-path:polygon(0_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,0_100%)]"
                    : i === path.length - 1
                      ? "rounded-r-lg [clip-path:polygon(0_0,100%_0,100%_100%,0_100%,8px_50%)]"
                      : "[clip-path:polygon(0_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,0_100%,8px_50%)]",
                  active
                    ? "text-white shadow-card"
                    : done
                      ? "bg-primary/12 text-primary hover:bg-primary/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
                style={active ? { backgroundColor: s.color } : undefined}
              >
                {pending === s.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : done ? (
                  <Check className="size-3.5" />
                ) : s.isWon ? (
                  <Trophy className="size-3.5" />
                ) : null}
                <span className="truncate">{s.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {lost && (
        <button
          type="button"
          onClick={(e) => moveTo(lost, e.currentTarget)}
          disabled={!!pending}
          className={cn(
            "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
            isLostNow
              ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : "text-muted-foreground hover:border-rose-500/40 hover:text-rose-600"
          )}
        >
          {pending === lost.id ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
          {isLostNow ? lost.name : "Segna come persa"}
        </button>
      )}
    </div>
  );
}
