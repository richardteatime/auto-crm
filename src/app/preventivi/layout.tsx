import ModuleGuard from "@/components/layout/ModuleGuard";

export default function PreventiviLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="quotes">
      {children}
    </ModuleGuard>
  );
}
