"use client";

import nextDynamic from "next/dynamic";

export const WorkflowEditor = nextDynamic(
  () =>
    import("@/components/workflows/WorkflowEditor").then(
      (m) => m.WorkflowEditor,
    ),
  { ssr: false },
);
