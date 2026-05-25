import ModuleGuard from "@/components/layout/ModuleGuard";

export default function TimelineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="timeline">
      {children}
    </ModuleGuard>
  );
}
