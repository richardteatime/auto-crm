import { getSetting, setSetting } from "./settings";
import type { ModuleId } from "@/lib/modules";
import { getDefaultModulesConfig } from "@/lib/modules";

const MODULES_KEY = "enabled_modules";

export async function getModulesConfig(): Promise<ModuleId[]> {
  const raw = await getSetting(MODULES_KEY);
  if (!raw) return getDefaultModulesConfig();
  try {
    const parsed = JSON.parse(raw) as ModuleId[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore parse errors
  }
  return getDefaultModulesConfig();
}

export async function setModulesConfig(modules: ModuleId[]): Promise<void> {
  await setSetting(MODULES_KEY, JSON.stringify(modules));
}
