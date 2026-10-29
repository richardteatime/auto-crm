"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** SarconX monogram (S + X) on a brand-blue tile */
export function BrandMark({ className }: { className?: string }) {
  // Unique per instance: a shared id breaks when the first mark sits in a hidden panel
  const gradientId = "sx-tile" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d8bff" />
          <stop offset="1" stopColor="#0d4aa6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <rect x="1" y="1" width="62" height="62" rx="15" fill="none" stroke="white" strokeOpacity=".18" strokeWidth="2" />
      <path d="M43 17 22 47M22 17l21 30" fill="none" stroke="#a9d4ff" strokeWidth="6.2" strokeLinecap="round" opacity=".85" />
      <path
        d="M20 21.5h15.7c5 0 8.2 2.55 8.2 6.55 0 4.15-3.25 6.55-8.55 6.55H28.5c-5.15 0-8.45 2.35-8.45 6.45 0 4.2 3.45 6.95 8.8 6.95H44"
        fill="none"
        stroke="white"
        strokeWidth="5.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="21.5" r="3.15" fill="#a9d4ff" />
      <circle cx="44" cy="48" r="3.15" fill="#a9d4ff" />
    </svg>
  );
}
