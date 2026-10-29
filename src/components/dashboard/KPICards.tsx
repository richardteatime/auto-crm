"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Handshake, Trophy, Target, UserPlus } from "lucide-react";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { Sparkline } from "@/components/shared/Sparkline";
import { formatCurrencyShort } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard";

function Trend({ value, previous, suffix = "vs mese scorso" }: { value: number; previous: number | null; suffix?: string }) {
  if (previous === null) return null;
  if (previous === 0 && value === 0) return <span className="text-xs text-muted-foreground">Stabile {suffix}</span>;
  const delta = previous === 0 ? 100 : Math.round(((value - previous) / previous) * 100);
  const up = delta >= 0;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1 py-px font-semibold tabular-nums",
          up ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/12 text-rose-700 dark:text-rose-300"
        )}
      >
        {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
        {Math.abs(delta)}%
      </span>
      {suffix}
    </span>
  );
}

export function KPICards({ kpis }: { kpis: DashboardData["kpis"] }) {
  const cards = [
    {
      href: "/pipeline",
      label: "Pipeline aperta",
      icon: Handshake,
      tone: "text-primary",
      value: <AnimatedNumber value={kpis.openValue.value} format="currency" />,
      sub: (
        <span className="text-xs text-muted-foreground">
          {kpis.openValue.count} aperte ·{" "}
          <span className="font-medium text-foreground tabular-nums">{formatCurrencyShort(kpis.openValue.weighted)}</span> ponderato
        </span>
      ),
      chart: <Sparkline data={kpis.openValue.series} />,
    },
    {
      href: "/deals",
      label: "Vinto questo mese",
      icon: Trophy,
      tone: "text-emerald-600 dark:text-emerald-400",
      value: <AnimatedNumber value={kpis.wonThisMonth.value} format="currency" />,
      sub: <Trend value={kpis.wonThisMonth.value} previous={kpis.wonThisMonth.previous} />,
      chart: <Sparkline data={kpis.wonThisMonth.series} variant="bars" />,
    },
    {
      href: "/deals",
      label: "Tasso di chiusura",
      icon: Target,
      tone: "text-violet-600 dark:text-violet-400",
      value: <AnimatedNumber value={kpis.winRate.value} format="percent" />,
      sub: (
        <span className="text-xs text-muted-foreground">
          {kpis.winRate.won} vinte su {kpis.winRate.closed} chiuse
        </span>
      ),
      chart: <Sparkline data={kpis.winRate.series} />,
    },
    {
      href: "/contacts",
      label: "Nuovi contatti",
      icon: UserPlus,
      tone: "text-amber-600 dark:text-amber-400",
      value: <AnimatedNumber value={kpis.newContacts.value} />,
      sub: <Trend value={kpis.newContacts.value} previous={kpis.newContacts.previous} />,
      chart: <Sparkline data={kpis.newContacts.series} variant="bars" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((card, i) => (
        <Link
          key={card.label}
          href={card.href}
          style={{ animationDelay: `${80 + i * 50}ms` }}
          className="group relative flex animate-fade-up flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 shadow-card transition-all hover:-translate-y-px hover:border-input hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <card.icon className={cn("size-4", card.tone)} />
              {card.label}
            </span>
            <ArrowUpRight className="size-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 text-[22px] font-bold leading-none tracking-tight tabular-nums sm:text-[26px]">{card.value}</div>
            <div className={cn("hidden h-9 w-24 shrink-0 sm:block", card.tone)}>{card.chart}</div>
          </div>
          <div className="-mt-1 min-h-5">{card.sub}</div>
        </Link>
      ))}
    </div>
  );
}
