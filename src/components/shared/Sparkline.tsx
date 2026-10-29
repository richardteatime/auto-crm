"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** Tiny trend line; inherits its colour from `currentColor` */
export function Sparkline({
  data,
  className,
  height = 36,
  width = 120,
  variant = "line",
}: {
  data: number[];
  className?: string;
  height?: number;
  width?: number;
  variant?: "line" | "bars";
}) {
  const id = "spark" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = variant === "bars" ? 0 : Math.min(...data, 0);
  const span = max - min || 1;
  const pad = 2;

  if (variant === "bars") {
    const gap = 3;
    const bw = (width - gap * (data.length - 1)) / data.length;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={cn("size-full overflow-visible", className)} aria-hidden="true" preserveAspectRatio="none">
        {data.map((v, i) => {
          const h = Math.max(2, ((v - min) / span) * (height - pad));
          return (
            <rect
              key={i}
              x={i * (bw + gap)}
              y={height - h}
              width={bw}
              height={h}
              rx={2}
              fill="currentColor"
              opacity={i === data.length - 1 ? 1 : 0.28}
            />
          );
        })}
      </svg>
    );
  }

  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => [i * step, height - pad - ((v - min) / span) * (height - pad * 2)] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lx, ly] = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("size-full overflow-visible", className)} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-fill)`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="2.5" fill="currentColor" />
    </svg>
  );
}
