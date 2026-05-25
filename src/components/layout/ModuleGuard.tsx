import { notFound } from "next/navigation";
import { getModulesConfig } from "@/lib/db/modules";
import type { ModuleId } from "@/lib/modules";

interface ModuleGuardProps {
  children: React.ReactNode;
  moduleId: ModuleId;
}

export default async function ModuleGuard({ children, moduleId }: ModuleGuardProps) {
  try {
    const enabled = await getModulesConfig();
    console.log("[ModuleGuard] moduleId:", moduleId, "enabled:", enabled);
    if (!enabled.includes(moduleId)) {
      notFound();
    }
    return <>{children}</>;
  } catch (e) {
    console.error("[ModuleGuard] error:", e);
    notFound();
  }
}
