"use client";

import { useNotifications } from "@/components/shared/NotificationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Activity, GitBranch, CalendarDays, MessageSquare, Bell, CheckCheck, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const typeConfig = {
  activity_assigned: { label: "Attività", icon: Activity, color: "text-primary", bg: "bg-primary/10" },
  project_assigned: { label: "Progetto", icon: GitBranch, color: "text-purple-600", bg: "bg-purple-600/10" },
  calendar_assigned: { label: "Calendario", icon: CalendarDays, color: "text-success", bg: "bg-success/10" },
  chat_message: { label: "Chat", icon: MessageSquare, color: "text-warning", bg: "bg-warning/10" },
};

export default function NotificationsPage() {
  const { notifications, counts, markRead, markAllRead, refresh, loading } = useNotifications();
  const router = useRouter();

  const unreadFirst = [...notifications].sort((a, b) => {
    if (a.read === b.read) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return a.read ? 1 : -1;
  });

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      refresh();
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Notifiche</h1>
          <p className="text-xs text-muted-foreground">
            {counts.total > 0
              ? `${counts.total} non letta${counts.total > 1 ? "e" : ""}`
              : "Tutto letto"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading} className="cursor-pointer">
            Aggiorna
          </Button>
          {counts.total > 0 && (
            <Button onClick={markAllRead} className="cursor-pointer gap-2">
              <CheckCheck className="h-4 w-4" />
              Segna tutte lette
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Elenco notifiche</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Nessuna notifica"
              description="Quando ti assegnano un progetto, un evento o un'attività, comparirà qui."
            />
          ) : (
            <div className="space-y-2">
              {unreadFirst.map((n) => {
                const config = typeConfig[n.type] || typeConfig.project_assigned;
                const Icon = config.icon;
                const href =
                  n.relatedType === "activity"
                    ? "/activities"
                    : n.relatedType === "project"
                      ? "/timeline"
                      : n.relatedType === "calendar_event"
                        ? "/calendar"
                        : n.relatedType === "message"
                          ? "/messages"
                          : null;

                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 p-2.5 rounded-md border transition-colors",
                      !n.read
                        ? "bg-primary/5 border-primary/10"
                        : "bg-card border-border hover:bg-muted/30"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                        config.bg,
                        config.color
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          !n.read ? "font-semibold" : "font-normal text-muted-foreground"
                        )}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {config.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: it })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!n.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markRead(n.id)}
                          className="h-8 w-8 p-0 cursor-pointer"
                          title="Segna come letta"
                        >
                          <CheckCheck className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                      {href && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(href)}
                          className="h-8 px-2 text-xs cursor-pointer"
                        >
                          Vedi
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(n.id)}
                        className="h-8 w-8 p-0 cursor-pointer text-destructive hover:text-destructive"
                        title="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
