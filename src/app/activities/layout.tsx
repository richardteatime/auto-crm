import ModuleGuard from "@/components/layout/ModuleGuard";

export default function ActivitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="activities">
      {children}
    </ModuleGuard>
  );
}
