"use client";

import nextDynamic from "next/dynamic";

export const PipelineChart = nextDynamic(
  () =>
    import("@/components/dashboard/PipelineChart").then(
      (m) => m.PipelineChart,
    ),
  { ssr: false },
);
