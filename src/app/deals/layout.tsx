import ModuleGuard from "@/components/layout/ModuleGuard";

export default function DealsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="deals">
      {children}
    </ModuleGuard>
  );
}
