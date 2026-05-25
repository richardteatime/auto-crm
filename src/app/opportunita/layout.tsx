import ModuleGuard from "@/components/layout/ModuleGuard";

export default function OpportunitaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="opportunita">
      {children}
    </ModuleGuard>
  );
}
