"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, PartyPopper, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { dueLabel } from "@/lib/dates";
import { ActivityIcon } from "./ActivityIcon";
import type { FocusItem } from "@/lib/dashboard";

export function FocusList({ items, nowMs }: { items: FocusItem[]; nowMs: number }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);

  async function complete(item: FocusItem) {
    setPending(item.id);
    try {
      const res = await fetch(`/api/activities/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: true }),
      });
      if (!res.ok) throw new Error();
      setDone((prev) => new Set(prev).add(item.id));
      toast.success("Fatto!", { description: item.description });
      router.refresh();
    } catch {
      toast.error("Non sono riuscito a completare l'attività");
    } finally {
      setPending(null);
    }
  }

  const visible = items.filter((i) => !done.has(i.id));

  if (visible.length === 0) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
          <PartyPopper className="size-5" />
        </span>
        <p className="text-sm font-semibold">Niente in sospeso per oggi</p>
        <p className="max-w-[260px] text-xs text-muted-foreground">
          Hai chiuso tutti i follow-up in scadenza. Un buon momento per sentire un lead caldo.
        </p>
      </div>
    );
  }

  return (
    <ul className="-mx-2 divide-y divide-border/70">
      {visible.map((item) => (
        <li key={item.id} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
          <button
            type="button"
            onClick={() => complete(item)}
            disabled={pending === item.id}
            aria-label={`Segna come fatta: ${item.description}`}
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all",
              item.overdue ? "border-rose-400/70" : "border-input",
              "hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
            )}
          >
            {pending === item.id ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
            )}
          </button>
          <ActivityIcon type={item.type} className="size-7" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.description}</p>
            <p className="truncate text-xs text-muted-foreground">
              {item.contactId && item.contactName ? (
                <Link href={`/contacts/${item.contactId}`} className="hover:text-foreground hover:underline">
                  {item.contactName}
                </Link>
              ) : (
                "Senza contatto"
              )}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
              item.overdue
                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                : "bg-muted text-muted-foreground"
            )}
          >
            {dueLabel(item.dueMs, nowMs)}
          </span>
        </li>
      ))}
    </ul>
  );
}
