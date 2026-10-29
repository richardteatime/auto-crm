import Link from "next/link";
import { agoLabel } from "@/lib/dates";
import { ActivityIcon, ACTIVITY_ICONS } from "./ActivityIcon";
import type { DashboardData } from "@/lib/dashboard";

export function RecentActivity({ items, nowMs }: { items: DashboardData["recent"]; nowMs: number }) {
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-border">
      {items.map((a) => (
        <li key={a.id} className="relative flex gap-3">
          <ActivityIcon type={a.type} className="size-7 ring-4 ring-card" />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-sm">{a.description}</p>
            <p className="truncate text-xs text-muted-foreground">
              {(ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.note).label}
              {a.completed ? (a.type === "follow_up" ? " completato" : " completata") : ""}
              {a.contactName && (
                <>
                  {" · "}
                  {a.contactId ? (
                    <Link href={`/contacts/${a.contactId}`} className="hover:text-foreground hover:underline">
                      {a.contactName}
                    </Link>
                  ) : (
                    a.contactName
                  )}
                </>
              )}
              {" · "}
              {agoLabel(a.atMs, nowMs)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
