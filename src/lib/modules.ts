/**
 * Module system for white-label CRM.
 *
 * Core modules are always enabled. Optional modules can be toggled
 * per-client via Settings > Modules.
 */

export type ModuleId =
  | "activities"
  | "calendar"
  | "contacts"
  | "deals"
  | "opportunita"
  | "pipeline"
  | "notifications"
  | "finance"
  | "timeline"
  | "messages"
  | "quotes"
  | "digest";

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
    id: "contacts",
    label: "Contatti",
    description: "Gestione lead e contatti",
    pages: ["/contacts"],
    apiRoutes: ["/api/contacts", "/api/import", "/api/export", "/api/classify"],
  },
  {
    id: "deals",
    label: "Trattative",
    description: "Gestione opportunità di vendita",
    pages: ["/deals"],
    apiRoutes: ["/api/deals"],
  },
  {
    id: "opportunita",
    label: "Opportunità",
    description: "Pipeline avanzato e opportunità",
    pages: ["/opportunita"],
    apiRoutes: ["/api/opportunities"],
  },
  {
    id: "pipeline",
    label: "Pipeline",
    description: "Visualizzazione Kanban del pipeline",
    pages: ["/pipeline"],
    apiRoutes: ["/api/pipeline"],
  },
  {
    id: "activities",
    label: "Attività",
    description: "Attività, follow-up e cronologia",
    pages: ["/activities"],
    apiRoutes: ["/api/activities", "/api/followups"],
  },
  {
    id: "calendar",
    label: "Calendario",
    description: "Eventi e appuntamenti",
    pages: ["/calendar"],
    apiRoutes: ["/api/calendar"],
  },
  {
    id: "notifications",
    label: "Notifiche",
    description: "Notifiche in-app e avvisi",
    pages: ["/notifications"],
    apiRoutes: ["/api/notifications"],
  },
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
