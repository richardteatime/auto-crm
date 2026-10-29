"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ListChecks, FolderKanban, CalendarDays, MessageSquare, CheckCheck, BellOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNotifications } from "./NotificationContext";
import type { AppNotification } from "@/lib/db/notifications";

const TYPE_STYLE: Record<AppNotification["type"], { icon: typeof Bell; tone: string }> = {
  activity_assigned: { icon: ListChecks, tone: "bg-sky-500/12 text-sky-600 dark:text-sky-300" },
  project_assigned: { icon: FolderKanban, tone: "bg-violet-500/12 text-violet-600 dark:text-violet-300" },
  calendar_assigned: { icon: CalendarDays, tone: "bg-amber-500/12 text-amber-600 dark:text-amber-300" },
  chat_message: { icon: MessageSquare, tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
};

function hrefFor(n: AppNotification): string | null {
  switch (n.relatedType) {
    case "activity":
      return "/activities";
    case "project":
      return n.relatedId ? `/timeline/${n.relatedId}` : "/timeline";
    case "calendar_event":
      return "/calendar";
    case "message":
      return "/messages";
    default:
      return null;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const { notifications, counts, markAllRead, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const recent = notifications.slice(0, 12);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) refresh();
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={counts.total > 0 ? `Notifiche, ${counts.total} da leggere` : "Notifiche"}
            className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
          />
        }
      >
        <Bell className="size-4" />
        {counts.total > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary ring-2 ring-background" />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,380px)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifiche</span>
            {counts.total > 0 && (
              <span className="rounded-full bg-primary/12 px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-primary">
                {counts.total}
              </span>
            )}
          </div>
          {counts.total > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              Segna tutte lette
            </button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                <BellOff className="size-4 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">Tutto tranquillo</p>
              <p className="text-xs text-muted-foreground">Qui arrivano attività, eventi e messaggi assegnati a te.</p>
            </div>
          ) : (
            recent.map((n) => {
              const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.activity_assigned;
              const Icon = style.icon;
              const href = hrefFor(n);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (href) router.push(href);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/60",
                    !n.read && "bg-primary/[0.04]"
                  )}
                >
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", style.tone)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm leading-snug", n.read ? "text-muted-foreground" : "font-semibold")}>
                      {n.title}
                    </span>
                    {n.body && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {n.fromUserName ? `${n.fromUserName} · ` : ""}
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: it })}
                    </span>
                  </span>
                  {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })
          )}
        </div>

        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t px-4 py-2.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          Vedi tutte le notifiche
        </Link>
      </PopoverContent>
    </Popover>
  );
}
