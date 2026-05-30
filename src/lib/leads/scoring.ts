import type { LeadCategory, LeadScoreBand, ParsedLead } from "./types";

// ---------------------------------------------------------------------------
// Lead scoring — deterministic, per PLAN.md
//   +20 email present
//   +20 phone present
//   +20 message contains a clear request
//   +20 category not "unknown"
//   +20 budget present
//   max 100
// ---------------------------------------------------------------------------

const REQUEST_KEYWORDS = [
  "sito",
  "website",
  "web",
  "app",
  "webapp",
  "crm",
  "gestionale",
  "automat",
  "preventiv",
  "progetto",
  "ecommerce",
  "shop",
  "landing",
  "piattaforma",
  "software",
  "serve",
  "vorrei",
  "bisogno",
  "need",
  "build",
];

export function hasClearRequest(message?: string | null): boolean {
  if (!message) return false;
  const text = message.trim().toLowerCase();
  if (text.length < 12) return false;
  return REQUEST_KEYWORDS.some((kw) => text.includes(kw));
}

export interface ScoreInput {
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  category?: LeadCategory;
  budget?: string | null;
}

export function computeLeadScore(input: ScoreInput): number {
  let score = 0;
  if (input.email && input.email.trim()) score += 20;
  if (input.phone && input.phone.trim()) score += 20;
  if (hasClearRequest(input.message)) score += 20;
  if (input.category && input.category !== "unknown") score += 20;
  if (input.budget && input.budget.trim()) score += 20;
  return Math.min(score, 100);
}

export function scoreBand(score: number): LeadScoreBand {
  if (score >= 70) return "hot";
  if (score >= 40) return "medium";
  return "weak";
}

export function scoreBandLabel(score: number): string {
  const band = scoreBand(score);
  return band === "hot"
    ? "Lead caldo"
    : band === "medium"
      ? "Lead medio"
      : "Lead debole";
}

export function scoreFromParsed(parsed: ParsedLead): number {
  return computeLeadScore({
    email: parsed.email,
    phone: parsed.phone,
    message: parsed.message,
    category: parsed.category,
    budget: parsed.budget,
  });
}
