import type { LeadCategory } from "./types";

// ---------------------------------------------------------------------------
// Category classification — keyword based (deterministic).
// AI classification is layered on top in parser/ai-extract.ts when available.
// ---------------------------------------------------------------------------

interface CategoryRule {
  category: LeadCategory;
  keywords: string[];
}

// Order matters: more specific categories first.
const RULES: CategoryRule[] = [
  {
    category: "crm",
    keywords: ["crm", "gestionale", "gestione clienti", "gestione lead", "anagrafica clienti"],
  },
  {
    category: "automation",
    keywords: [
      "automat",
      "automazione",
      "workflow",
      "integrazione",
      "zapier",
      "n8n",
      "bot",
      "processo automatico",
    ],
  },
  {
    category: "webapp",
    keywords: [
      "webapp",
      "web app",
      "applicazione",
      "piattaforma",
      "dashboard",
      "gestione ordini",
      "area riservata",
      "portale",
      "saas",
    ],
  },
  {
    category: "static_website",
    keywords: [
      "sito",
      "website",
      "sito web",
      "landing",
      "vetrina",
      "presentazione",
      "blog",
      "portfolio",
    ],
  },
];

export function classifyCategoryByKeywords(
  ...texts: Array<string | null | undefined>
): LeadCategory {
  const haystack = texts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) return "unknown";

  for (const rule of RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.category;
    }
  }

  return "unknown";
}

// Normalize a free-text projectType field (e.g. from a form) to a category.
export function categoryFromProjectType(
  projectType?: string | null,
): LeadCategory | null {
  if (!projectType) return null;
  const t = projectType.toLowerCase().trim();
  if (!t) return null;
  if (t.includes("crm") || t.includes("gestionale")) return "crm";
  if (t.includes("automat")) return "automation";
  if (t.includes("webapp") || t.includes("web app") || t.includes("applicazione"))
    return "webapp";
  if (t.includes("sito") || t.includes("website") || t.includes("landing"))
    return "static_website";
  return null;
}
