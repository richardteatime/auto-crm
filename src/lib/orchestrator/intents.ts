import type { Intent } from "./types";

// ---------------------------------------------------------------------------
// AI provider: same pattern as src/lib/claude.ts
// ---------------------------------------------------------------------------

const openRouterKey = process.env.OPENROUTER_API_KEY || "";
const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
const openRouterModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

function hasAI(): boolean {
  return !!(openRouterKey || anthropicKey);
}

async function classifyViaOpenRouter(prompt: string): Promise<string | null> {
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

async function classifyViaAnthropic(prompt: string): Promise<string | null> {
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
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(messageText: string): string {
  return `Classifica l'intento del seguente messaggio in italiano. Rispondi SOLO con il nome dell'intento esatto dalla lista.

Messaggio: "${messageText}"

Intenti supportati:
- project_status_query: "A che progetti stiamo lavorando?", "Quali progetti sono in corso?"
- revenue_today_query: "Quanti ricavi abbiamo fatto oggi?", "Quanto abbiamo venduto?"
- lead_summary_query: "Dammi il riepilogo dei lead", "Quali lead abbiamo?"
- blocked_projects_query: "Quali progetti sono bloccati?", "Cosa è fermo?"
- agent_status_query: "Che agenti sono attivi?", "Stato automazioni"
- deployment_status_query: "Stato deploy", "App deployate?"
- create_project_command: "Crea progetto per...", "Nuovo progetto..."
- create_deal_command: "Crea deal per...", "Nuova opportunità..."
- create_task_command: "Crea task...", "Aggiungi follow-up..."
- start_static_site_workflow: "Avvia workflow sito statico per..."
- generate_app_for_client: "Crea un'app per...", "Genera sito per..."
- tasks_query: "Cosa devo fare oggi?", "Quali task ho?", "Ho follow-up scaduti?"
- unknown: nessuno degli intenti sopra

Rispondi con una sola parola: il nome esatto dell'intento.`;
}

function parseIntent(text: string): Intent {
  const clean = text.trim().toLowerCase();
  const intents: Intent[] = [
    "project_status_query",
    "revenue_today_query",
    "lead_summary_query",
    "blocked_projects_query",
    "agent_status_query",
    "deployment_status_query",
    "create_project_command",
    "create_deal_command",
    "create_task_command",
    "start_static_site_workflow",
    "generate_app_for_client",
    "tasks_query",
    "unknown",
  ];
  for (const intent of intents) {
    if (clean.includes(intent)) return intent;
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Keyword fallback
// ---------------------------------------------------------------------------

function classifyByKeywords(text: string): Intent {
  const t = text.toLowerCase();

  if (/progett|project|lavor|in corso|attiv/i.test(t) && /bloccat|ferm|ritard/i.test(t)) {
    return "blocked_projects_query";
  }
  if (/progett|project|lavor|in corso|attiv/i.test(t)) {
    return "project_status_query";
  }
  if (/ricav|revenue|vendut|incassat|fatturat|soldi/i.test(t)) {
    return "revenue_today_query";
  }
  if (/lead|prospect|contatt/i.test(t)) {
    return "lead_summary_query";
  }
  if (/agent|automazion|bot|workflow/i.test(t) && /status|stato|attiv/i.test(t)) {
    return "agent_status_query";
  }
  if (/deploy|online|preview|link|url/i.test(t)) {
    return "deployment_status_query";
  }
  if (/crea .*progett|nuovo progett/i.test(t)) {
    return "create_project_command";
  }
  if (/crea .*deal|nuova opportunit|nuovo deal/i.test(t)) {
    return "create_deal_command";
  }
  if (/crea .*task|aggiungi .*follow|ricordami/i.test(t)) {
    return "create_task_command";
  }
  if (/avvia .*workflow|workflow .*sito|fai partire .*sito/i.test(t)) {
    return "start_static_site_workflow";
  }
  if (/crea .*app|genera .*app|crea .*sito|genera .*sito|webapp/i.test(t)) {
    return "generate_app_for_client";
  }
  if (/task|fare|da fare|todo|follow.?up|scadenze|deadline/i.test(t)) {
    return "tasks_query";
  }

  return "unknown";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function classifyIntent(messageText: string): Promise<Intent> {
  if (!hasAI()) {
    return classifyByKeywords(messageText);
  }

  const prompt = buildPrompt(messageText);
  let responseText: string | null = null;

  if (openRouterKey) {
    responseText = await classifyViaOpenRouter(prompt);
  } else if (anthropicKey) {
    responseText = await classifyViaAnthropic(prompt);
  }

  if (responseText) {
    return parseIntent(responseText);
  }

  return classifyByKeywords(messageText);
}
