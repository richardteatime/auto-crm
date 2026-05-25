import ModuleGuard from "@/components/layout/ModuleGuard";

export default function ContactsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuard moduleId="contacts">
      {children}
    </ModuleGuard>
  );
}
