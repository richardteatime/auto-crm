import type { Temperature, ActivityType } from "@/types";

// ---------------------------------------------------------------------------
// AI provider: OpenRouter (default) → Anthropic (fallback) → nessuna IA
// ---------------------------------------------------------------------------

const openRouterKey = process.env.OPENROUTER_API_KEY || "";
const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
const openRouterModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

function hasAI(): boolean {
  return !!(openRouterKey || anthropicKey);
}

// ---------------------------------------------------------------------------
// OpenRouter (OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------

async function classifyViaOpenRouter(
  prompt: string,
): Promise<string | null> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openRouterModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

// ---------------------------------------------------------------------------
// Anthropic SDK (fallback)
// ---------------------------------------------------------------------------

async function classifyViaAnthropic(
  prompt: string,
): Promise<string | null> {
  // Dynamic import so the SDK is only loaded when needed
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: anthropicKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : null;
}

// ---------------------------------------------------------------------------
// Classify lead
// ---------------------------------------------------------------------------

interface ClassifyResult {
  temperature: Temperature;
  score: number;
  nextAction: string;
  reasoning: string;
}

const DEFAULT_RESULT: ClassifyResult = {
  temperature: "cold",
  score: 25,
  nextAction: "Inviare email di presentazione",
  reasoning: "Classificazione predefinita (nessuna API key configurata)",
};

function buildPrompt(
  contactInfo: {
    name: string;
    company?: string;
    source?: string;
    notes?: string;
  },
  interactionHistory: Array<{
    type: ActivityType;
    description: string;
    date: string;
  }>,
): string {
  const historyText = interactionHistory
    .map((i) => `- ${i.date}: [${i.type}] ${i.description}`)
    .join("\n");

  return `Analizza questo lead e classifica la sua temperatura. Rispondi SOLO con JSON valido.

Contatto:
- Nome: ${contactInfo.name}
- Azienda: ${contactInfo.company || "Non specificata"}
- Fonte: ${contactInfo.source || "Non specificata"}
- Note: ${contactInfo.notes || "Nessuna nota"}

Storico interazioni:
${historyText || "Nessuna interazione registrata"}

Rispondi con questo formato JSON esatto:
{
  "temperature": "cold" | "warm" | "hot",
  "score": <numero 0-100>,
  "nextAction": "<prossima azione consigliata in italiano>",
  "reasoning": "<motivazione della classificazione in italiano>"
}`;
}

function parseResponse(text: string): ClassifyResult | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as ClassifyResult;
  } catch {
    return null;
  }
}

export async function classifyLead(
  contactInfo: {
    name: string;
    company?: string;
    source?: string;
    notes?: string;
  },
  interactionHistory: Array<{
    type: ActivityType;
    description: string;
    date: string;
  }>,
): Promise<ClassifyResult> {
  if (!hasAI()) return DEFAULT_RESULT;

  const prompt = buildPrompt(contactInfo, interactionHistory);

  // Prefer OpenRouter if configured, else Anthropic
  let responseText: string | null = null;

  if (openRouterKey) {
    responseText = await classifyViaOpenRouter(prompt);
  } else if (anthropicKey) {
    responseText = await classifyViaAnthropic(prompt);
  }

  if (responseText) {
    const parsed = parseResponse(responseText);
    if (parsed) return parsed;
  }

  return {
    temperature: "cold",
    score: 25,
    nextAction: "Rivedere manualmente",
    reasoning: "Impossibile analizzare la risposta dell'IA",
  };
}

export { hasAI as isAIEnabled };
