import ModuleGuard from "@/components/layout/ModuleGuard";

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="calendar">
      {children}
    </ModuleGuard>
  );
}
