"use client";

import { CalendarDays, Check, Paperclip, Pencil, Plus, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityIcon, ACTIVITY_ICONS } from "@/components/dashboard/ActivityIcon";
import { getActivityStatus } from "@/lib/constants";
import { agoLabel, formatDayShort, formatTime } from "@/lib/dates";
import { toMs } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface TimelineActivity {
  id: string;
  type: string;
  description: string;
  startAt?: number | Date | null;
  endAt?: number | Date | null;
  notes?: string | null;
  attachments?: string | null;
  dealId?: string | null;
  scheduledAt: number | Date | null;
  completedAt: number | Date | null;
  createdAt: number | Date;
}

const STATUS = {
  overdue: { label: "Scaduta", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  open: { label: "Da fare", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  completed: { label: "Fatta", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
} as const;

export function ContactTimeline({
  activities,
  onAdd,
  onComplete,
  onEdit,
  nowMs,
}: {
  activities: TimelineActivity[];
  nowMs: number;
  onAdd: () => void;
  onComplete: (id: string) => void;
  onEdit: (a: TimelineActivity) => void;
}) {
  // Things to do first (oldest due first), then the history (newest first)
  const sorted = [...activities].sort((a, b) => {
    const sa = getActivityStatus(a) === "completed" ? 1 : 0;
    const sb = getActivityStatus(b) === "completed" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (sa === 0) return toMs(a.startAt ?? a.scheduledAt ?? a.createdAt) - toMs(b.startAt ?? b.scheduledAt ?? b.createdAt);
    return toMs(b.completedAt ?? b.createdAt) - toMs(a.completedAt ?? a.createdAt);
  });

  return (
    <section className="rounded-xl border bg-card shadow-card">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <ListChecks className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Cronologia</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{activities.length}</span>
        <Button size="sm" variant="outline" onClick={onAdd} className="ml-auto gap-1">
          <Plus className="size-3.5" />
          Registra attività
        </Button>
      </header>

      {sorted.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium">Ancora nessuna interazione</p>
          <p className="mt-1 text-xs text-muted-foreground">Registra una chiamata, un&apos;email o una nota per iniziare la storia.</p>
        </div>
      ) : (
        <ol className="relative px-4 py-4 before:absolute before:bottom-6 before:left-[31px] before:top-6 before:w-px before:bg-border">
          {sorted.map((a) => {
            const status = getActivityStatus(a);
            const badge = STATUS[status];
            let files: { name: string; url: string }[] = [];
            try {
              files = JSON.parse(a.attachments || "[]");
            } catch {
              /* malformed attachments: ignore */
            }
            const when = a.startAt ?? a.scheduledAt;
            return (
              <li key={a.id} className="group relative flex gap-3 pb-5 last:pb-0">
                <ActivityIcon type={a.type} className={cn("relative z-10 ring-4 ring-card", status === "completed" && "opacity-70")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {(ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.note).label}
                    </span>
                    <span className={cn("rounded-md px-1.5 py-px text-[11px] font-semibold", badge.className)}>{badge.label}</span>
                    {files.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <Paperclip className="size-3" />
                        {files.length}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">{agoLabel(toMs(a.createdAt), nowMs)}</span>
                  </div>
                  <p className={cn("mt-1 text-sm font-medium", status === "completed" && "text-muted-foreground")}>{a.description}</p>
                  {when && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="size-3" />
                      {formatDayShort(toMs(when))}, {formatTime(toMs(when))}
                      {a.endAt ? ` – ${formatTime(toMs(a.endAt))}` : ""}
                    </p>
                  )}
                  {a.notes && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{a.notes}</p>}
                  {files.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {files.map((f) => (
                        <a
                          key={f.url}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[11px] text-primary hover:bg-muted"
                        >
                          <Paperclip className="size-3" />
                          {f.name}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    {status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => onComplete(a.id)}
                        className="inline-flex h-6 items-center gap-1 rounded-md border bg-background px-2 text-[11px] font-medium hover:border-emerald-500/50 hover:text-emerald-600"
                      >
                        <Check className="size-3" />
                        Segna come fatta
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(a)}
                      className="inline-flex h-6 items-center gap-1 rounded-md border bg-background px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3" />
                      Modifica
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
