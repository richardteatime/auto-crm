"use client";

import { useEffect, useRef } from "react";

type Format = "currency" | "number" | "percent";

const formatters: Record<Format, Intl.NumberFormat> = {
  currency: new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
  number: new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }),
  percent: new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }),
};

function render(value: number, format: Format) {
  // Currency values arrive in cents, like everywhere else in the CRM
  if (format === "currency") return formatters.currency.format(value / 100);
  if (format === "percent") return `${formatters.percent.format(value)}%`;
  return formatters.number.format(value);
}

/**
 * Server-renders the final value, then counts up to it on mount by writing the
 * text node directly (no re-renders). Instant when the user prefers reduced motion.
 */
export function AnimatedNumber({
  value,
  format = "number",
  duration = 900,
  className,
}: {
  value: number;
  format?: Format;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === value) {
      el.textContent = render(value, format);
      fromRef.current = value;
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // ease-out-expo
      el.textContent = render(Math.round(from + (value - from) * eased), format);
      if (p < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = render(value, format);
    };
  }, [value, format, duration]);

  return (
    <span className={className} aria-label={render(value, format)}>
      <span ref={ref} aria-hidden="true">
        {render(value, format)}
      </span>
    </span>
  );
}
