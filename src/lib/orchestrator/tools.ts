import type { Intent } from "./types";
import {
  getActiveProjects,
  getBlockedProjects,
  getTodayRevenue,
  getLeadSummary,
  getAgentStatus,
  getDeploymentStatus,
  getMyTasksToday,
} from "./query-tools";
import {
  createProjectFromMessage,
  createDealFromMessage,
  createTaskFromMessage,
} from "./command-tools";
import { createContact, listContacts, getContact } from "@/lib/db/contacts";

// ---------------------------------------------------------------------------
// AI provider helpers (same pattern as intents.ts / claude.ts)
// ---------------------------------------------------------------------------

const openRouterKey = process.env.OPENROUTER_API_KEY || "";
const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
const openRouterModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o";

function hasAI(): boolean {
  return !!(openRouterKey || anthropicKey);
}

async function callOpenRouter(prompt: string): Promise<string | null> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openRouterModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function callAnthropic(prompt: string): Promise<string | null> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: anthropicKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : null;
}

// ---------------------------------------------------------------------------
// Tool definitions (description sent to AI)
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = `
Sei l'orchestrator intelligente di un CRM. L'utente ti scrive in linguaggio naturale in italiano o spagnolo.
Hai accesso alle seguenti funzioni del CRM.

PUOI FARE PIU' CHIAMATE IN SEQUENZA. Se non sei sicuro se un contatto esiste, CERCALO PRIMA con un tool di QUERY, poi decidi.

--- TOOL DI QUERY (per raccogliere informazioni prima di agire) ---

q1. searchContacts(name: string)
    Descrizione: Cerca contatti nel CRM per nome. Restituisce la lista dei contatti trovati.
    Esempio: searchContacts("Rossi") → restituisce contatti con nome simile a Rossi.

q2. getContactDetails(id: string)
    Descrizione: Ottieni i dettagli completi di un contatto dato il suo ID.

--- TOOL DI AZIONE E RISPOSTA (quando hai tutte le informazioni necessarie) ---

1. getActiveProjects()
   Descrizione: Restituisce la lista dei progetti attivi e il loro stato.
   Esempio utente: "A che progetti stiamo lavorando?"

2. getTodayRevenue()
   Descrizione: Restituisce i ricavi fatti oggi.
   Esempio utente: "Quanti ricavi abbiamo fatto oggi?"

3. getLeadSummary()
   Descrizione: Restituisce il riepilogo dei lead.
   Esempio utente: "Dammi il riepilogo dei lead"

4. getBlockedProjects()
   Descrizione: Restituisce i progetti bloccati o in ritardo.
   Esempio utente: "Quali progetti sono bloccati?"

5. getAgentStatus()
   Descrizione: Restituisce lo stato degli agenti automazione.
   Esempio utente: "Che agenti sono attivi?"

6. getDeploymentStatus()
   Descrizione: Restituisce lo stato dei deploy.
   Esempio utente: "Stato deploy?"

7. getMyTasksToday()
   Descrizione: Restituisce le task di oggi, scadute e in scadenza.
   Esempio utente: "Cosa devo fare oggi?"

8. createProject(clientName: string, title: string, description?: string, status?: string, priority?: string, dueDate?: string)
   Descrizione: Crea un nuovo progetto per un cliente.
   REGOLE per il titolo: massimo 4-5 parole, sintetico. Tutti i dettagli vanno nella descrizione.
   Esempio utente: "Aggiungi progetto per Rossi: sito web e-commerce, aperto, priorità alta"
   Estrazione corretta:
     clientName: "Rossi"
     title: "Sito web e-commerce"
     description: "Progetto per Rossi. Sito web e-commerce. Stato: aperto. Priorità: alta."
     status: "aperto"
     priority: "alta"
   ATTENZIONE: se l'utente indica una data di scadenza (es. entro venerdì 29 maggio), mettila in dueDate nel formato gg/mm/aaaa. NON mettere la scadenza nella descrizione.

9. createDeal(clientName: string, amount: number, title?: string, description?: string, probability?: number, expectedClose?: string)
   Descrizione: Crea un nuovo deal/opportunita per un cliente.
   Esempio utente: "Crea deal per Rossi da 5000 euro - preventivo sito web, 80% entro il 30/06"
   Estrazione corretta:
     title: "Preventivo sito web"
     description: "Deal per Rossi da 5000 euro."
     probability: 80
     expectedClose: "30/06/2026"
   ATTENZIONE: se l'utente indica una percentuale (es. 90%), mettila in probability. Se indica una data di chiusura (es. entro il 20/06), mettila in expectedClose nel formato gg/mm/aaaa. NON mettere questi dati nelle note/description.

10. createTask(title: string, dueDate?: string, description?: string)
    Descrizione: Crea una nuova task.
    REGOLE per il titolo: massimo 4-5 parole, sintetico.
    Esempio utente: "Crea task chiamare cliente domani alle 10 per discutere il preventivo"
    Estrazione corretta:
      title: "Chiamare cliente"
      description: "Chiamare cliente domani alle 10 per discutere il preventivo"
      dueDate: "domani"

11. createContact(name: string, temperature?: string, source?: string)
    Descrizione: Crea un nuovo contatto/lead nel CRM.
    Esempio utente: "Aggiungi contatto Mario Rossi temperatura caldo"

12. reply(message: string)
    Descrizione: Rispondi direttamente all'utente quando nessuna funzione e appropriata o devi chiedere chiarimenti.
    Esempio utente: "Ciao!", "Come funziona?"

REGOLE:
- Rispondi SEMPRE in formato JSON valido.
- Se l'utente vuole creare un CONTATTO/LEAD, usa createContact, NON createTask.
- Se l'utente vuole sapere qualcosa, usa la funzione di query appropriata.
- Se non capisci cosa vuole, usa reply con una domanda di chiarimento.
- Per createProject, createTask e createDeal: il TITOLO deve essere BREVE (max 5 parole). I dettagli vanno nella DESCRIZIONE.
- Estrai i parametri dal messaggio dell'utente in modo intelligente.
- IMPORTANTE: quando l'utente chiede di creare un deal/progetto per un cliente, SE NON SEI SICURO che il contatto esista, USA searchContacts PRIMA di createDeal/createProject. Se non trovi nulla, usa reply per chiedere all'utente.

FORMATO RISPOSTA:
{"tool": "nomeFunzione", "args": {"parametro": "valore"}}

Esempio multi-step:
Utente: "Crea deal per Rossi da 5000 euro"
Passo 1: {"tool": "searchContacts", "args": {"name": "Rossi"}}
Risultato: Nessun contatto trovato con nome: Rossi
Passo 2: {"tool": "reply", "args": {"message": "Non trovo il contatto Rossi nel CRM. Lo creo?"}}

Esempi corretti singolo-step:
Utente: "Aggiungi contatto Marco Bianchi temperatura caldo"
Risposta: {"tool": "createContact", "args": {"name": "Marco Bianchi", "temperature": "hot"}}

Utente: "Aggiungi progetto per Rossi: sito web e-commerce, aperto, priorità alta"
Risposta: {"tool": "createProject", "args": {"clientName": "Rossi", "title": "Sito web e-commerce", "description": "Stato: aperto. Priorità: alta.", "status": "aperto", "priority": "alta"}}

Utente: "Crea task chiamare cliente domani per il preventivo"
Risposta: {"tool": "createTask", "args": {"title": "Chiamare cliente", "description": "Chiamare cliente per il preventivo", "dueDate": "domani"}}
`;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

function parseToolCall(text: string): ToolCall | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "tool" in parsed &&
      typeof (parsed as Record<string, unknown>).tool === "string" &&
      "args" in parsed &&
      typeof (parsed as Record<string, unknown>).args === "object"
    ) {
      return parsed as ToolCall;
    }
  } catch {
    // ignore
  }
  return null;
}

// ---------------------------------------------------------------------------
// Keyword-based fallback (no AI)
// ---------------------------------------------------------------------------

function classifyByKeywords(messageText: string): ToolCall {
  const t = messageText.toLowerCase();

  if (/progett|project|lavor|in corso|attiv/i.test(t) && /bloccat|ferm|ritard/i.test(t)) {
    return { tool: "getBlockedProjects", args: {} };
  }
  if (/progett|project|lavor|in corso|attiv/i.test(t)) {
    return { tool: "getActiveProjects", args: {} };
  }
  if (/ricav|revenue|vendut|incassat|fatturat|soldi/i.test(t)) {
    return { tool: "getTodayRevenue", args: {} };
  }
  if (/lead|prospect/i.test(t)) {
    return { tool: "getLeadSummary", args: {} };
  }
  if (/agent|automazion|bot|workflow/i.test(t) && /status|stato|attiv/i.test(t)) {
    return { tool: "getAgentStatus", args: {} };
  }
  if (/deploy|online|preview|link|url/i.test(t)) {
    return { tool: "getDeploymentStatus", args: {} };
  }
  if (/task|fare|da fare|todo|follow.?up|scadenze|deadline/i.test(t)) {
    return { tool: "getMyTasksToday", args: {} };
  }
  if (/crea .*progett|nuovo progett/i.test(t)) {
    return { tool: "createProject", args: {} };
  }
  if (/crea .*deal|nuova opportunit|nuovo deal/i.test(t)) {
    return { tool: "createDeal", args: {} };
  }
  if (/crea .*task|aggiungi .*follow|ricordami/i.test(t)) {
    return { tool: "createTask", args: {} };
  }
  if (/aggiungi .*contatt|crea .*contatt|nuovo contatt|nuovo lead/i.test(t)) {
    return { tool: "createContact", args: {} };
  }

  return { tool: "reply", args: { message: "Non ho capito il comando." } };
}

// ---------------------------------------------------------------------------
// Conversation memory: pending tool calls waiting for clarification
// ---------------------------------------------------------------------------

interface PendingTool {
  toolCall: ToolCall;
  originalMessage: string;
  timestamp: number;
}

const pendingToolCalls = new Map<number, PendingTool>();
const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getPending(conversationId: number): PendingTool | null {
  const pending = pendingToolCalls.get(conversationId);
  if (!pending) return null;
  if (Date.now() - pending.timestamp > PENDING_TTL_MS) {
    pendingToolCalls.delete(conversationId);
    return null;
  }
  return pending;
}

function setPending(conversationId: number, toolCall: ToolCall, originalMessage: string) {
  pendingToolCalls.set(conversationId, { toolCall, originalMessage, timestamp: Date.now() });
}

function clearPending(conversationId: number) {
  pendingToolCalls.delete(conversationId);
}

// ---------------------------------------------------------------------------
// ReAct loop: multi-step reasoning + acting
// ---------------------------------------------------------------------------

const MAX_REACT_STEPS = 5;

const FINAL_TOOLS = new Set([
  "getActiveProjects",
  "getTodayRevenue",
  "getLeadSummary",
  "getBlockedProjects",
  "getAgentStatus",
  "getDeploymentStatus",
  "getMyTasksToday",
  "createProject",
  "createDeal",
  "createTask",
  "createContact",
  "reply",
]);

function isFinalTool(tool: string): boolean {
  return FINAL_TOOLS.has(tool);
}

interface ReActStep {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

async function executeQueryTool(toolCall: ToolCall): Promise<string> {
  switch (toolCall.tool) {
    case "searchContacts": {
      const name = (toolCall.args.name as string) || "";
      try {
        const contacts = await listContacts({ search: name });
        if (contacts.length === 0) {
          return `Nessun contatto trovato con nome: "${name}".`;
        }
        const lines = contacts.map(
          (c) =>
            `- ${c.name} (ID: ${c.id}, temperatura: ${c.temperature || "non specificata"}, telefono: ${c.phone || "non specificato"}, email: ${c.email || "non specificata"})`,
        );
        return `Contatti trovati (${contacts.length}):\n${lines.join("\n")}`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Errore nella ricerca contatti: ${msg}`;
      }
    }

    case "getContactDetails": {
      const id = (toolCall.args.id as string) || "";
      try {
        const contact = await getContact(id);
        if (!contact) {
          return `Contatto non trovato con ID: ${id}.`;
        }
        return (
          `Contatto: ${contact.name}\n` +
          `ID: ${contact.id}\n` +
          `Temperatura: ${contact.temperature || "non specificata"}\n` +
          `Email: ${contact.email || "non specificata"}\n` +
          `Telefono: ${contact.phone || "non specificato"}\n` +
          `Azienda: ${contact.company || "non specificata"}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Errore nel caricamento contatto: ${msg}`;
      }
    }

    default:
      return `Tool di query "${toolCall.tool}" non supportato.`;
  }
}

function buildReActPrompt(messageText: string, steps: ReActStep[]): string {
  let prompt = `${TOOL_DEFINITIONS}\n\n`;
  prompt += `Messaggio utente: "${messageText}"\n`;

  if (steps.length > 0) {
    prompt += `\n--- PASSAGGI PRECEDENTI ---\n`;
    steps.forEach((step, i) => {
      prompt += `Passo ${i + 1}:\n`;
      prompt += `  Chiamata: {"tool": "${step.tool}", "args": ${JSON.stringify(step.args)}}\n`;
      prompt += `  Risultato: ${step.result}\n\n`;
    });
  }

  prompt += `--- PROSSIMO PASSO ---\n`;
  prompt += `Rispondi con il JSON della funzione da chiamare per questo passo.`;
  return prompt;
}

async function runReActLoop(
  messageText: string,
  conversationId?: number,
): Promise<ToolCall> {
  const steps: ReActStep[] = [];

  for (let i = 0; i < MAX_REACT_STEPS; i++) {
    const prompt = buildReActPrompt(messageText, steps);

    let responseText: string | null = null;
    if (openRouterKey) {
      responseText = await callOpenRouter(prompt);
    } else if (anthropicKey) {
      responseText = await callAnthropic(prompt);
    }

    if (!responseText) {
      break;
    }

    const parsed = parseToolCall(responseText);
    if (!parsed) {
      break;
    }

    // If it's a final tool (action, reply, or direct query), return it
    if (isFinalTool(parsed.tool)) {
      return parsed;
    }

    // It's an intermediate query tool — execute and add to steps
    const result = await executeQueryTool(parsed);
    steps.push({ tool: parsed.tool, args: parsed.args, result });
  }

  return { tool: "reply", args: { message: "Non ho capito. Puoi ripetere?" } };
}

// ---------------------------------------------------------------------------
// AI tool router
// ---------------------------------------------------------------------------

export async function chooseTool(
  messageText: string,
  conversationId?: number,
): Promise<ToolCall> {
  // Check if there's a pending tool waiting for clarification
  if (conversationId != null) {
    const pending = getPending(conversationId);
    if (pending) {
      const combinedPrompt = `${TOOL_DEFINITIONS}

Prima l'utente ha chiesto: "${pending.originalMessage}"
Poi ha risposto: "${messageText}"

Completa la richiesta originale usando anche la risposta. Rispondi con il JSON della funzione da chiamare:`;

      let responseText: string | null = null;
      if (openRouterKey) {
        responseText = await callOpenRouter(combinedPrompt);
      } else if (anthropicKey) {
        responseText = await callAnthropic(combinedPrompt);
      }

      clearPending(conversationId);

      if (responseText) {
        const parsed = parseToolCall(responseText);
        if (parsed) return parsed;
      }
    }
  }

  if (!hasAI()) {
    return classifyByKeywords(messageText);
  }

  return runReActLoop(messageText, conversationId);
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

export async function executeTool(
  toolCall: ToolCall,
  messageText: string,
  runId: string | null,
): Promise<{ success: boolean; reply: string; intent: Intent }> {
  switch (toolCall.tool) {
    case "getActiveProjects": {
      try {
        const reply = await getActiveProjects();
        return { success: true, reply, intent: "project_status_query" };
      } catch (err) {
        return {
          success: false,
          reply: "Errore nel caricamento progetti.",
          intent: "project_status_query",
        };
      }
    }

    case "getTodayRevenue": {
      try {
        const reply = await getTodayRevenue();
        return { success: true, reply, intent: "revenue_today_query" };
      } catch (err) {
        return {
          success: false,
          reply: "Errore nel caricamento ricavi.",
          intent: "revenue_today_query",
        };
      }
    }

    case "getLeadSummary": {
      try {
        const reply = await getLeadSummary();
        return { success: true, reply, intent: "lead_summary_query" };
      } catch (err) {
        return {
          success: false,
          reply: "Errore nel caricamento lead.",
          intent: "lead_summary_query",
        };
      }
    }

    case "getBlockedProjects": {
      try {
        const reply = await getBlockedProjects();
        return { success: true, reply, intent: "blocked_projects_query" };
      } catch (err) {
        return {
          success: false,
          reply: "Errore nel caricamento progetti bloccati.",
          intent: "blocked_projects_query",
        };
      }
    }

    case "getAgentStatus": {
      try {
        const reply = await getAgentStatus();
        return { success: true, reply, intent: "agent_status_query" };
      } catch (err) {
        return {
          success: false,
          reply: "Errore nel caricamento stato agenti.",
          intent: "agent_status_query",
        };
      }
    }

    case "getDeploymentStatus": {
      try {
        const reply = await getDeploymentStatus();
        return { success: true, reply, intent: "deployment_status_query" };
      } catch (err) {
        return {
          success: false,
          reply: "Errore nel caricamento stato deploy.",
          intent: "deployment_status_query",
        };
      }
    }

    case "getMyTasksToday": {
      try {
        const reply = await getMyTasksToday();
        return { success: true, reply, intent: "tasks_query" };
      } catch (err) {
        return {
          success: false,
          reply: "Errore nel caricamento task.",
          intent: "tasks_query",
        };
      }
    }

    case "createProject": {
      const { reply, projectId } = await createProjectFromMessage(messageText, runId, {
        clientName: toolCall.args.clientName as string | undefined,
        title: toolCall.args.title as string | undefined,
        description: toolCall.args.description as string | undefined,
        status: toolCall.args.status as string | undefined,
        priority: toolCall.args.priority as string | undefined,
        dueDate: toolCall.args.dueDate as string | undefined,
      });
      return { success: !!projectId, reply, intent: "create_project_command" };
    }

    case "createDeal": {
      const { reply, dealId } = await createDealFromMessage(messageText, runId, {
        clientName: toolCall.args.clientName as string | undefined,
        title: toolCall.args.title as string | undefined,
        description: toolCall.args.description as string | undefined,
        probability: toolCall.args.probability as number | undefined,
        expectedClose: toolCall.args.expectedClose as string | undefined,
      });
      return { success: !!dealId, reply, intent: "create_deal_command" };
    }

    case "createTask": {
      const { reply, taskId } = await createTaskFromMessage(messageText, runId, {
        title: toolCall.args.title as string | undefined,
        description: toolCall.args.description as string | undefined,
        dueDate: toolCall.args.dueDate as string | undefined,
      });
      return { success: !!taskId, reply, intent: "create_task_command" };
    }

    case "createContact": {
      try {
        const name = (toolCall.args.name as string) || extractNameFromText(messageText);
        if (!name) {
          return {
            success: false,
            reply: "Non ho capito il nome del contatto. Prova con: 'Aggiungi contatto Mario Rossi'.",
            intent: "unknown",
          };
        }

        const temperature = parseTemperature((toolCall.args.temperature as string) || extractTemperatureFromText(messageText));
        const source = (toolCall.args.source as string) || "webhook";

        const contact = await createContact({ name, temperature, source });

        return {
          success: true,
          reply: `Contatto creato: *${contact.name}*\nTemperatura: ${contact.temperature || "non specificata"}\nID: ${contact.id}`,
          intent: "unknown",
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          reply: "Errore nella creazione contatto: " + msg,
          intent: "unknown",
        };
      }
    }

    case "reply": {
      const replyMsg = (toolCall.args.message as string) || "Non ho capito.";
      return { success: true, reply: replyMsg, intent: "unknown" };
    }

    case "searchContacts": {
      try {
        const reply = await executeQueryTool(toolCall);
        return { success: true, reply, intent: "unknown" };
      } catch (err) {
        return { success: false, reply: "Errore nella ricerca contatti.", intent: "unknown" };
      }
    }

    case "getContactDetails": {
      try {
        const reply = await executeQueryTool(toolCall);
        return { success: true, reply, intent: "unknown" };
      } catch (err) {
        return { success: false, reply: "Errore nel caricamento contatto.", intent: "unknown" };
      }
    }

    default: {
      return {
        success: false,
        reply: `Funzione "${toolCall.tool}" non supportata.`,
        intent: "unknown",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Extraction helpers for createContact
// ---------------------------------------------------------------------------

function extractNameFromText(text: string): string | null {
  // "contatto [Name]" or "contatto [Name] temperatura"
  const match = text.match(/contatto\s+([^,]+?)(?:\s+(?:temperatura|temp|caldo|freddo|tibio|hot|cold|warm)|$)/i);
  if (match) return match[1].trim();

  // "Aggiungi [Name]"
  const match2 = text.match(/aggiungi\s+([^,]+?)(?:\s+(?:temperatura|temp|caldo|freddo|tibio|hot|cold|warm)|$)/i);
  if (match2) return match2[1].trim();

  return null;
}

function extractTemperatureFromText(text: string): string | null {
  const t = text.toLowerCase();
  if (/caldo|hot/i.test(t)) return "hot";
  if (/tibio|warm/i.test(t)) return "warm";
  if (/freddo|cold/i.test(t)) return "cold";
  return null;
}

function parseTemperature(t: string | null): string | undefined {
  if (!t) return undefined;
  const lower = t.toLowerCase();
  if (lower === "hot" || lower === "caldo") return "hot";
  if (lower === "warm" || lower === "tibio") return "warm";
  if (lower === "cold" || lower === "freddo") return "cold";
  return undefined;
}
