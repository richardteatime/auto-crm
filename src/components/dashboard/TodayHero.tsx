import Link from "next/link";
import { AlertCircle, CalendarClock, ListChecks, Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Chip {
  href: string;
  icon: typeof AlertCircle;
  label: string;
  tone: string;
}

export function TodayHero({
  greeting,
  firstName,
  dateLabel,
  overdue,
  today,
  events,
  hot,
}: {
  greeting: string;
  firstName: string;
  dateLabel: string;
  overdue: number;
  today: number;
  events: number;
  hot: number;
}) {
  const chips: Chip[] = [];
  if (overdue > 0)
    chips.push({
      href: "/activities",
      icon: AlertCircle,
      label: `${overdue} ${overdue === 1 ? "follow-up scaduto" : "follow-up scaduti"}`,
      tone: "border-rose-500/25 bg-rose-500/8 text-rose-700 dark:text-rose-300",
    });
  if (today > 0)
    chips.push({
      href: "/activities",
      icon: ListChecks,
      label: `${today} ${today === 1 ? "attività" : "attività"} per oggi`,
      tone: "border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300",
    });
  if (events > 0)
    chips.push({
      href: "/calendar",
      icon: CalendarClock,
      label: `${events} ${events === 1 ? "evento" : "eventi"} in agenda oggi`,
      tone: "border-sky-500/25 bg-sky-500/8 text-sky-700 dark:text-sky-300",
    });
  if (hot > 0)
    chips.push({
      href: "/contacts",
      icon: Flame,
      label: `${hot} ${hot === 1 ? "lead caldo" : "lead caldi"}`,
      tone: "border-orange-500/25 bg-orange-500/8 text-orange-700 dark:text-orange-300",
    });

  const calm = overdue === 0 && today === 0 && events === 0;

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card px-5 py-6 shadow-card md:px-7 md:py-7">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-brand-radial opacity-90" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground first-letter:uppercase">
          {dateLabel}
        </p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight md:text-[32px] md:leading-tight">
          {greeting}
          {firstName ? (
            <>
              , <span className="text-gradient-brand">{firstName}</span>
            </>
          ) : null}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground md:text-[15px]">
          {calm ? (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-4 text-primary" />
              Giornata libera da scadenze: perfetta per far avanzare la pipeline.
            </span>
          ) : (
            "Ecco cosa ti aspetta oggi. Parti dalle cose in rosso."
          )}
        </p>
        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Link
                key={chip.label}
                href={chip.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-transform hover:-translate-y-px",
                  chip.tone
                )}
              >
                <chip.icon className="size-3.5" />
                {chip.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
