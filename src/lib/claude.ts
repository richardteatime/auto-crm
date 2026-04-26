import Anthropic from "@anthropic-ai/sdk";
import type { Temperature, ActivityType } from "@/types";

const apiKey = process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!apiKey) return null;
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function isAIEnabled(): boolean {
  return !!apiKey;
}

interface ClassifyResult {
  temperature: Temperature;
  score: number;
  nextAction: string;
  reasoning: string;
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
  }>
): Promise<ClassifyResult> {
  const anthropic = getClient();
  if (!anthropic) {
    return {
      temperature: "cold",
      score: 25,
      nextAction: "Inviare email di presentazione",
      reasoning: "Classificazione predefinita (nessuna API key configurata)",
    };
  }

  const historyText = interactionHistory
    .map((i) => `- ${i.date}: [${i.type}] ${i.description}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Analizza questo lead e classifica la sua temperatura. Rispondi SOLO con JSON valido.

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
}`,
      },
    ],
  });

  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ClassifyResult;
    }
  } catch {
    // Fall through to default
  }

  return {
    temperature: "cold",
    score: 25,
    nextAction: "Rivedere manualmente",
    reasoning: "Impossibile analizzare la risposta dell'IA",
  };
}
