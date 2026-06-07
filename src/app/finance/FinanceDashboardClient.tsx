"use client";

import nextDynamic from "next/dynamic";

export const FinanceDashboard = nextDynamic(
  () => import("./FinanceDashboard").then((m) => m.FinanceDashboard),
  { ssr: false },
);
