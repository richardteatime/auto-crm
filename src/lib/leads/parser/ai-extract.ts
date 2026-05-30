import type { LeadCategory, ParsedLead } from "../types";
import { LEAD_CATEGORIES } from "../types";

// ---------------------------------------------------------------------------
// AI extraction — OpenRouter (default) → Anthropic (fallback) → null.
// Mirrors the provider pattern in src/lib/claude.ts.
// NEVER blocks the flow: returns null if no provider or on any error.
// ---------------------------------------------------------------------------

const openRouterKey = process.env.OPENROUTER_API_KEY || "";
const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
const openRouterModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o";

export function isAIExtractionEnabled(): boolean {
  return !!(openRouterKey || anthropicKey);
}

function buildPrompt(subject: string, body: string): string {
  return `Sei un assistente che estrae i dati di un lead da una email di richiesta.
Rispondi SOLO con JSON valido, senza testo aggiuntivo.

Oggetto: ${subject || "(nessuno)"}
Corpo:
${body}

Estrai questi campi (usa null se non presente). Per "category" scegli UNO tra:
${LEAD_CATEGORIES.join(", ")}.
- static_website = sito vetrina/landing/portfolio
- webapp = applicazione web, piattaforma, area riservata
- crm = gestionale clienti
- automation = automazione di processi
- other = richiesta chiara ma fuori categoria
- unknown = dati insufficienti

Formato JSON esatto:
{
  "firstName": "",
  "lastName": "",
  "fullName": "",
  "email": "",
  "phone": "",
  "company": "",
  "businessName": "",
  "website": "",
  "projectType": "",
  "category": "",
  "budget": "",
  "message": "",
  "customFields": {}
}`;
}

async function callOpenRouter(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function callAnthropic(prompt: string): Promise<string | null> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: anthropicKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : null;
  } catch {
    return null;
  }
}

function parseJsonResponse(text: string): ParsedLead | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const str = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t && t.toLowerCase() !== "null" ? t : null;
    };
    const category = str(raw.category);
    const cf =
      raw.customFields && typeof raw.customFields === "object"
        ? (raw.customFields as Record<string, unknown>)
        : {};
    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(cf)) {
      if (typeof v === "string" && v.trim()) customFields[k] = v.trim();
    }
    return {
      firstName: str(raw.firstName),
      lastName: str(raw.lastName),
      fullName: str(raw.fullName),
      email: str(raw.email),
      phone: str(raw.phone),
      company: str(raw.company),
      businessName: str(raw.businessName),
      website: str(raw.website),
      projectType: str(raw.projectType),
      category:
        category && LEAD_CATEGORIES.includes(category as LeadCategory)
          ? (category as LeadCategory)
          : undefined,
      budget: str(raw.budget),
      message: str(raw.message),
      customFields,
    };
  } catch {
    return null;
  }
}

export async function extractWithAI(
  subject: string,
  body: string,
): Promise<ParsedLead | null> {
  if (!isAIExtractionEnabled()) return null;
  const prompt = buildPrompt(subject, body);

  let responseText: string | null = null;
  if (openRouterKey) {
    responseText = await callOpenRouter(prompt);
  } else if (anthropicKey) {
    responseText = await callAnthropic(prompt);
  }

  if (!responseText) return null;
  return parseJsonResponse(responseText);
}
