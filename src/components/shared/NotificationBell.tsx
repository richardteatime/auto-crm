"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Activity, GitBranch, CheckCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useNotifications } from "./NotificationContext";
import type { AppNotification } from "@/lib/db/notifications";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

function NotificationItem({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const router = useRouter();

  const href =
    notification.relatedType === "activity"
      ? "/activities"
      : notification.relatedType === "project"
        ? "/timeline"
        : null;

  function handleClick() {
    if (!notification.read) onRead(notification.id);
    if (href) router.push(href);
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0",
        !notification.read && "bg-blue-50/50 dark:bg-blue-950/20",
      )}
    >
      <div
        className={cn(
          "mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
          notification.type === "activity_assigned"
            ? "bg-blue-100 text-blue-600"
            : "bg-purple-100 text-purple-600",
        )}
      >
        {notification.type === "activity_assigned" ? (
          <Activity className="h-4 w-4" />
        ) : (
          <GitBranch className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-snug",
            !notification.read ? "font-semibold" : "font-normal text-muted-foreground",
          )}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{notification.body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
            locale: it,
          })}
        </p>
      </div>
      {!notification.read && (
        <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
      )}
    </button>
  );
}

export function NotificationBell() {
  const { notifications, counts, markRead, markAllRead, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleOpen() {
    setOpen((v) => !v);
    if (!open) refresh();
  }

  const recent = notifications.slice(0, 20);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors cursor-pointer"
        aria-label="Notifiche"
      >
        <Bell className="h-5 w-5" />
        {counts.total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {counts.total > 99 ? "99+" : counts.total}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">
              Notifiche{" "}
              {counts.total > 0 && (
                <span className="ml-1 rounded-full bg-red-100 text-red-600 text-xs px-1.5 py-0.5">
                  {counts.total}
                </span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {counts.total > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted cursor-pointer"
                  title="Segna tutte come lette"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tutte lette
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nessuna notifica
              </div>
            ) : (
              recent.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={(id) => {
                    markRead(id);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
