import ModuleGuard from "@/components/layout/ModuleGuard";

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="messages">
      {children}
    </ModuleGuard>
  );
}
