import { Flame, Snowflake, ThermometerSun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Temperature } from "@/types";

const STYLE: Record<Temperature, { label: string; icon: typeof Flame; className: string }> = {
  hot: {
    label: "Caldo",
    icon: Flame,
    className: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300",
  },
  warm: {
    label: "Tiepido",
    icon: ThermometerSun,
    className: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
  },
  cold: {
    label: "Freddo",
    icon: Snowflake,
    className: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
  },
};

interface StatusBadgeProps {
  temperature: Temperature;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ temperature, size = "md", className }: StatusBadgeProps) {
  const cfg = STYLE[temperature] ?? STYLE.cold;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ring-1 ring-inset",
        size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs",
        cfg.className,
        className
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      {cfg.label}
    </span>
  );
}
