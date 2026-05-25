import ModuleGuard from "@/components/layout/ModuleGuard";
import FinanceAuthCheck from "@/components/layout/FinanceAuthCheck";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="finance">
      <FinanceAuthCheck>{children}</FinanceAuthCheck>
    </ModuleGuard>
  );
}
