"use client";

import nextDynamic from "next/dynamic";

export const CaptureAnalyticsDashboard = nextDynamic(
  () =>
    import("@/components/capture/CaptureAnalyticsDashboard").then(
      (m) => m.CaptureAnalyticsDashboard,
    ),
  { ssr: false },
);
