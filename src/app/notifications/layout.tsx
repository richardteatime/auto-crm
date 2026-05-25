import ModuleGuard from "@/components/layout/ModuleGuard";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="notifications">
      {children}
    </ModuleGuard>
  );
}
