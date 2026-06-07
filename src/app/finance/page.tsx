import nextDynamic from "next/dynamic";

const FinanceDashboard = nextDynamic(
  () => import("./FinanceDashboard").then((m) => m.FinanceDashboard),
  { ssr: false },
);

export const dynamic = "force-dynamic";

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Finance</h1>
        <p className="text-xs text-muted-foreground">
          Fatturato, spese, investimenti e cash flow
        </p>
      </div>
      <FinanceDashboard />
    </div>
  );
}
