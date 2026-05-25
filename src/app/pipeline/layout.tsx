import ModuleGuard from "@/components/layout/ModuleGuard";

export default function PipelineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="pipeline">
      {children}
    </ModuleGuard>
  );
}
