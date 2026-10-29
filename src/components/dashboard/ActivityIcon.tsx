import { Phone, Mail, Users, StickyNote, AlarmClock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const ACTIVITY_ICONS: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  call: { icon: Phone, tone: "bg-sky-500/12 text-sky-600 dark:text-sky-300", label: "Chiamata" },
  email: { icon: Mail, tone: "bg-violet-500/12 text-violet-600 dark:text-violet-300", label: "Email" },
  meeting: { icon: Users, tone: "bg-amber-500/12 text-amber-600 dark:text-amber-300", label: "Riunione" },
  note: { icon: StickyNote, tone: "bg-slate-500/12 text-slate-600 dark:text-slate-300", label: "Nota" },
  follow_up: { icon: AlarmClock, tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300", label: "Follow-up" },
};

export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const cfg = ACTIVITY_ICONS[type] ?? ACTIVITY_ICONS.note;
  const Icon = cfg.icon;
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", cfg.tone, className)}>
      <Icon className="size-4" />
    </span>
  );
}
