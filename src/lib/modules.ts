/**
 * Module system for white-label CRM.
 *
 * Core modules are always enabled. Optional modules can be toggled
 * per-client via Settings > Modules.
 */

export type ModuleId = "finance" | "timeline" | "messages" | "quotes" | "digest";

export interface ModuleDef {
  id: ModuleId;
  label: string;
  description: string;
  pages: string[];
  apiRoutes: string[];
}

/** Optional modules that can be disabled per-client */
export const OPTIONAL_MODULES: ModuleDef[] = [
  {
    id: "finance",
    label: "Finance",
    description: "MRR, spese, ricavi e report finanziari",
    pages: ["/finance"],
    apiRoutes: ["/api/finance", "/api/expenses", "/api/revenues", "/api/report"],
  },
  {
    id: "timeline",
    label: "Timeline / Progetti",
    description: "Gestione progetti e timeline",
    pages: ["/timeline"],
    apiRoutes: ["/api/projects"],
  },
  {
    id: "messages",
    label: "Chat Team",
    description: "Messaggi interni al team",
    pages: ["/messages"],
    apiRoutes: ["/api/messages"],
  },
  {
    id: "quotes",
    label: "Preventivi",
    description: "Generazione e gestione preventivi",
    pages: ["/preventivi"],
    apiRoutes: ["/api/quotes"],
  },
  {
    id: "digest",
    label: "Email Digest",
    description: "Resoconto giornaliero via email",
    pages: [],
    apiRoutes: ["/api/digest"],
  },
];

/** All optional module IDs */
export const OPTIONAL_MODULE_IDS: ModuleId[] = OPTIONAL_MODULES.map((m) => m.id);

/** Default: all optional modules enabled */
export function getDefaultModulesConfig(): ModuleId[] {
  return [...OPTIONAL_MODULE_IDS];
}

/** Check if a specific module is enabled in the given config */
export function isModuleEnabled(
  enabled: ModuleId[],
  moduleId: ModuleId
): boolean {
  return enabled.includes(moduleId);
}

/** Find which optional module owns a given page path */
export function getModuleForPage(path: string): ModuleId | null {
  for (const mod of OPTIONAL_MODULES) {
    if (mod.pages.some((p) => path === p || path.startsWith(p + "/"))) {
      return mod.id;
    }
  }
  return null;
}

/** Find which optional module owns a given API route */
export function getModuleForApiRoute(route: string): ModuleId | null {
  for (const mod of OPTIONAL_MODULES) {
    if (mod.apiRoutes.some((r) => route === r || route.startsWith(r + "/"))) {
      return mod.id;
    }
  }
  return null;
}
