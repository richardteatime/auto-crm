import {
  CATEGORY_LABELS,
  type Lead,
  type LeadCategory,
  type LeadQuoteItem,
} from "./types";

// ---------------------------------------------------------------------------
// Quote draft generator (Day 7). Builds a DRAFT only — never sent to the
// client without manual approval (PLAN security rule). Deterministic: does
// not depend on an AI provider, so it never blocks the proposal flow.
// ---------------------------------------------------------------------------

// Pricing base per category (euros). Placeholder, configurable.
export const PRICING: Record<
  LeadCategory,
  { basePrice: number; label: string }
> = {
  static_website: { basePrice: 1200, label: "Sito statico HTML/PHP admin" },
  webapp: { basePrice: 3500, label: "Webapp custom" },
  crm: { basePrice: 5000, label: "CRM custom" },
  automation: { basePrice: 2500, label: "Automazione processo" },
  other: { basePrice: 0, label: "Progetto su misura" },
  unknown: { basePrice: 0, label: "Da definire" },
};

// Bullet list of what's included, per category.
const INCLUDED: Record<LeadCategory, string[]> = {
  static_website: [
    "Design responsive (mobile/desktop)",
    "Fino a 5 sezioni/pagine",
    "Form di contatto",
    "Pannello admin base",
    "Ottimizzazione SEO di base",
  ],
  webapp: [
    "Analisi requisiti e UX",
    "Frontend custom",
    "Backend + database",
    "Autenticazione utenti",
    "Deploy iniziale",
  ],
  crm: [
    "Gestione clienti e contatti",
    "Pipeline commerciale",
    "Automazioni di base",
    "Ruoli e permessi",
    "Reportistica",
  ],
  automation: [
    "Analisi del processo",
    "Integrazione tra strumenti esistenti",
    "Automazione dei passaggi manuali",
    "Notifiche e log",
  ],
  other: ["Da definire in base alla richiesta"],
  unknown: ["Da definire dopo qualifica del lead"],
};

export interface QuoteDraft {
  category: LeadCategory;
  amountSuggested: number; // cents
  items: LeadQuoteItem[];
  summary: string;
  generatedText: string;
  clientBudget: number | null; // euros, if provided
}

function formatEuro(cents: number): string {
  return `€ ${(cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 0 })}`;
}

// Pull a client budget (euros) from the lead's customFields JSON, if present.
function readClientBudget(lead: Lead): number | null {
  if (!lead.customFields) return null;
  try {
    const cf = JSON.parse(lead.customFields) as Record<string, unknown>;
    const raw = cf.budget;
    if (typeof raw === "string" || typeof raw === "number") {
      const digits = String(raw).replace(/[^\d]/g, "");
      if (digits) return Number(digits);
    }
  } catch {
    // ignore malformed customFields
  }
  return null;
}

export function buildQuoteDraft(lead: Lead): QuoteDraft {
  const category = lead.category ?? "unknown";
  const pricing = PRICING[category] ?? PRICING.unknown;
  const amountSuggested = pricing.basePrice * 100; // euros → cents
  const clientBudget = readClientBudget(lead);

  const items: LeadQuoteItem[] = [
    { label: pricing.label, amount: amountSuggested },
  ];

  const included = INCLUDED[category] ?? INCLUDED.unknown;
  const company = lead.company ?? lead.businessName;
  const categoryLabel = CATEGORY_LABELS[category] ?? category;

  const lines: string[] = [
    "PREVENTIVO (BOZZA)",
    "",
    `Cliente: ${lead.fullName}${company ? ` — ${company}` : ""}`,
    `Categoria: ${categoryLabel}`,
    `Contatti: ${lead.email ?? "n/d"}${lead.phone ? ` · ${lead.phone}` : ""}`,
    "",
    "Richiesta:",
    lead.message?.trim() || "(nessun dettaglio fornito)",
    "",
    "Informazioni raccolte:",
    `- Azienda: ${company ?? "n/d"}`,
    `- Sito attuale: ${lead.website ?? "n/d"}`,
    `- Tipo progetto: ${lead.projectType ?? categoryLabel}`,
    `- Budget indicato dal cliente: ${clientBudget !== null ? `€ ${clientBudget.toLocaleString("it-IT")}` : "non indicato"}`,
    "",
    "Proposta di soluzione:",
    `Realizzazione di un progetto "${categoryLabel}" su misura per le esigenze del cliente.`,
    "",
    "Elementi inclusi:",
    ...included.map((i) => `- ${i}`),
    "",
    `Prezzo suggerito: ${amountSuggested > 0 ? formatEuro(amountSuggested) : "da definire"}`,
  ];

  if (clientBudget !== null) {
    lines.push(`Budget cliente: € ${clientBudget.toLocaleString("it-IT")}`);
  }

  lines.push(
    "",
    "Note e prossimi step:",
    "- Bozza generata automaticamente dal CRM.",
    "- NON inviata al cliente: richiede approvazione manuale prima dell'invio.",
    "- Verificare scope e personalizzare prezzo se necessario.",
  );

  const summary = `${categoryLabel} — ${amountSuggested > 0 ? formatEuro(amountSuggested) : "prezzo da definire"}${clientBudget !== null ? ` (budget cliente € ${clientBudget.toLocaleString("it-IT")})` : ""}`;

  return {
    category,
    amountSuggested,
    items,
    summary,
    generatedText: lines.join("\n"),
    clientBudget,
  };
}
