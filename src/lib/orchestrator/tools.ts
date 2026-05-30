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
  startStaticSiteWorkflow,
  generateAppForClient,
} from "./command-tools";
import { createContact, listContacts, getContact, updateContact, deleteContact } from "@/lib/db/contacts";
import { listDeals, updateDeal, deleteDeal } from "@/lib/db/deals";
import { listProjects, updateProject, deleteProject } from "@/lib/db/projects";
import { listTasks, updateTask, deleteTask } from "@/lib/db/tasks";
import { createActivity, listActivities, deleteActivity } from "@/lib/db/activities";
import { getStages } from "@/lib/db/pipeline";

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
   Esempio SBAGLIATO (NON fare mai questo):
     title: "Aggiungi progetto per Rossi: sito web e-commerce, aperto, priorità alta"
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

12. updateContact(name: string, temperature?: string, email?: string, phone?: string, company?: string)
    Descrizione: Aggiorna un contatto esistente nel CRM. Cerca il contatto per nome e aggiorna i campi forniti.
    Esempio utente: "Modifica la temperatura di Mario Rossi in warm"
    Esempio utente: "Aggiorna email di Rossi a rossi@example.com"

13. deleteContact(name: string)
    Descrizione: Elimina un contatto dal CRM.
    Esempio utente: "Elimina contatto Mario Rossi"

14. listDeals(clientName?: string)
    Descrizione: Elenca i deal. Se viene fornito il nome cliente, mostra solo i deal di quel cliente.
    Esempio utente: "Mostra i deal di Rossi"

15. updateDeal(clientName: string, value?: number, probability?: number, expectedClose?: string, notes?: string)
    Descrizione: Aggiorna il deal più recente di un cliente. Se ci sono più deal, aggiorna l'ultimo creato.
    Esempio utente: "Aggiorna importo deal Rossi a 10000"
    Esempio utente: "Cambia probabilità deal Rossi a 90%"

16. moveDeal(clientName: string, stageName: string)
    Descrizione: Sposta il deal più recente di un cliente in un'altra fase del pipeline.
    Esempio utente: "Sposta deal Rossi in vinto"

17. deleteDeal(clientName: string)
    Descrizione: Elimina il deal più recente di un cliente.
    Esempio utente: "Elimina deal per Rossi"

18. listProjects(clientName?: string)
    Descrizione: Elenca i progetti. Se viene fornito il nome cliente, mostra solo i progetti di quel cliente.
    Esempio utente: "Mostra i progetti di Rossi"

19. updateProject(clientName: string, status?: string, priority?: string, dueDate?: string, notes?: string)
    Descrizione: Aggiorna il progetto più recente di un cliente.
    Esempio utente: "Chiudi progetto Rossi"
    Esempio utente: "Modifica priorità progetto Rossi in alta"

20. deleteProject(clientName: string)
    Descrizione: Elimina il progetto più recente di un cliente.
    Esempio utente: "Elimina progetto Rossi"

21. listTasks()
    Descrizione: Elenca tutte le task.
    Esempio utente: "Mostra le mie task"

22. updateTask(titleKeyword: string, done?: boolean, dueDate?: string)
    Descrizione: Aggiorna una task cercandola per parola chiave nel titolo.
    Esempio utente: "Segna task chiamare cliente come completata"
    Esempio utente: "Rimanda task preventivo a domani"

23. deleteTask(titleKeyword: string)
    Descrizione: Elimina una task cercandola per parola chiave nel titolo.
    Esempio utente: "Elimina task chiamare cliente"

24. addActivity(clientName: string, description: string, type?: string)
    Descrizione: Aggiunge un'attività o nota a un contatto.
    Esempio utente: "Aggiungi nota a Rossi: ha chiamato oggi e conferma l'appuntamento"

25. listActivities(clientName: string)
    Descrizione: Elenca le attività recenti di un contatto.
    Esempio utente: "Mostra attività di Rossi"

26. done(message: string)
    Descrizione: Concludi la conversazione con un messaggio riassuntivo dopo aver completato tutte le azioni richieste. Usa questo SOLO quando hai finito di eseguire tutti i tool necessari.
    Esempio: l'utente chiede "crea contatto e task", dopo aver creato entrambi, usa done per rispondere.

27. reply(message: string)
    Descrizione: Rispondi direttamente all'utente quando nessuna funzione e appropriata o devi chiedere chiarimenti.
    Esempio utente: "Ciao!", "Come funziona?"

28. startStaticSiteWorkflow(clientName: string, title?: string, description?: string)
    Descrizione: Avvia un workflow per generare un sito statico per un cliente. Crea il progetto CRM e mette in coda il workflow per il dispacciamento GitAgent.
    Esempio utente: "Fai un sito statico per Trattoria Da Marco"
    Estrazione corretta:
      clientName: "Trattoria Da Marco"
      title: "Sito statico Trattoria Da Marco"

29. generateAppForClient(clientName: string, appType?: string, description?: string)
    Descrizione: Genera un'app/sito web per un cliente e avvia il workflow completo (progetto + deal + dispacciamento GitAgent). Usa questo quando l'utente chiede di creare un'app, un sito, una webapp o simili.
    Esempio utente: "Crea un'app per FitLab e mandami il link quando è online"
    Estrazione corretta:
      clientName: "FitLab"
      appType: "webapp"
    ATTENZIONE: se l'utente chiede di generare un'app per un cliente, SE NON SEI SICURO che il contatto esista, USA searchContacts PRIMA di generateAppForClient.

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

function setPending(conversationId: number, toolCall: ToolCall, messageText: string) {
  const existing = pendingToolCalls.get(conversationId);
  // Preserve the original message that started the conversation thread
  const originalMessage = existing ? existing.originalMessage : messageText;
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
  "updateContact",
  "deleteContact",
  "listDeals",
  "updateDeal",
  "moveDeal",
  "deleteDeal",
  "listProjects",
  "updateProject",
  "deleteProject",
  "listTasks",
  "updateTask",
  "deleteTask",
  "addActivity",
  "listActivities",
  "done",
  "reply",
  "startStaticSiteWorkflow",
  "generateAppForClient",
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
      let contextBlock = `- Messaggio originale dell'utente: "${pending.originalMessage}"`;
      if (pending.toolCall.tool === "reply" && pending.toolCall.args.message) {
        contextBlock += `\n- La tua ultima domanda: "${pending.toolCall.args.message}"`;
      } else {
        contextBlock += `\n- Tool che stavi per chiamare: {"tool": "${pending.toolCall.tool}", "args": ${JSON.stringify(pending.toolCall.args)}}`;
      }

      const combinedPrompt = `${TOOL_DEFINITIONS}

Contesto conversazionale:
${contextBlock}
- Nuovo messaggio dell'utente: "${messageText}"

Se l'utente ha risposto con informazioni mancanti (nome cliente, importo, data, ecc.), usa quelle informazioni per chiamare direttamente il tool appropriato (createProject, createDeal, createTask, createContact).
Se l'utente ha risposto "si", "ok", "certo" o simili, procedi con l'azione che stavi per fare.
Rispondi con il JSON del tool da chiamare.`;

      let responseText: string | null = null;
      if (openRouterKey) {
        responseText = await callOpenRouter(combinedPrompt);
      } else if (anthropicKey) {
        responseText = await callAnthropic(combinedPrompt);
      }

      if (responseText) {
        const parsed = parseToolCall(responseText);
        if (parsed) {
          clearPending(conversationId);
          return parsed;
        }
      }
    }
  }

  if (!hasAI()) {
    return classifyByKeywords(messageText);
  }

  return runReActLoop(messageText, conversationId);
}

// ---------------------------------------------------------------------------
// Multi-tool loop: choose next action after a step was executed
// ---------------------------------------------------------------------------

export async function chooseNextTool(
  messageText: string,
  previousSteps: Array<{ tool: string; result: string }>,
  conversationId?: number,
): Promise<ToolCall> {
  if (!hasAI()) {
    return { tool: "done", args: { message: "" } };
  }

  const history = previousSteps
    .map((s, i) => `${i + 1}. Tool: ${s.tool}\nRisultato: ${s.result}`)
    .join("\n\n");

  const prompt = `${TOOL_DEFINITIONS}\n\nMessaggio originale dell'utente: "${messageText}"\n\nHai già eseguito le seguenti azioni:\n${history}\n\nDevi decidere se c'e un'altra azione da fare per soddisfare COMPLETAMENTE la richiesta dell'utente.\n- Se SI', rispondi con il prossimo tool da chiamare (formato JSON).\n- Se NO, o se hai finito tutto, usa done(message) con un messaggio riassuntivo per l'utente.\n\nRicorda: rispondi SOLO con il JSON del tool.`;

  let responseText: string | null = null;
  if (openRouterKey) {
    responseText = await callOpenRouter(prompt);
  } else if (anthropicKey) {
    responseText = await callAnthropic(prompt);
  }

  if (responseText) {
    const parsed = parseToolCall(responseText);
    if (parsed) return parsed;
  }

  return { tool: "done", args: { message: "" } };
}

// ---------------------------------------------------------------------------
// Lookup helpers for update/delete tools
// ---------------------------------------------------------------------------

async function findContactByName(name: string): Promise<{ id: string; name: string } | null> {
  const contacts = await listContacts({ search: name });
  const exact = contacts.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (exact) return { id: exact.id, name: exact.name };
  if (contacts.length === 1) return { id: contacts[0].id, name: contacts[0].name };
  return null;
}

async function findDealByClientName(name: string): Promise<import("@/types").DealWithContact | null> {
  const contact = await findContactByName(name);
  if (!contact) return null;
  const deals = await listDeals({ contactId: contact.id });
  return deals[0] ?? null;
}

async function findProjectByClientName(name: string): Promise<import("@/types").Project | null> {
  const contact = await findContactByName(name);
  if (!contact) return null;
  const projects = await listProjects();
  const filtered = projects.filter((p) => p.contactId === contact.id);
  return filtered[0] ?? null;
}

async function findTaskByKeyword(keyword: string): Promise<import("@/types").Task | null> {
  const tasks = await listTasks();
  const lower = keyword.toLowerCase();
  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(lower));
  return filtered[0] ?? null;
}

// ---------------------------------------------------------------------------
// Title sanitization: reject AI titles that are too long or copy-pasted
// ---------------------------------------------------------------------------

function sanitizeTitle(title: unknown, messageText: string): string | undefined {
  if (typeof title !== "string") return undefined;
  if (title.length > 60) return undefined;
  if (title.length > messageText.length * 0.7) return undefined;
  return title;
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

export async function executeTool(
  toolCall: ToolCall,
  messageText: string,
  runId: string | null,
  conversationId?: number,
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
        title: sanitizeTitle(toolCall.args.title, messageText),
        description: toolCall.args.description as string | undefined,
        status: toolCall.args.status as string | undefined,
        priority: toolCall.args.priority as string | undefined,
        dueDate: toolCall.args.dueDate as string | undefined,
      });
      if (!projectId && conversationId != null && reply.startsWith("Non ho capito")) {
        setPending(conversationId, toolCall, messageText);
      }
      return { success: !!projectId, reply, intent: "create_project_command" };
    }

    case "createDeal": {
      const { reply, dealId } = await createDealFromMessage(messageText, runId, {
        clientName: toolCall.args.clientName as string | undefined,
        title: sanitizeTitle(toolCall.args.title, messageText),
        description: toolCall.args.description as string | undefined,
        probability: toolCall.args.probability as number | undefined,
        expectedClose: toolCall.args.expectedClose as string | undefined,
      });
      if (!dealId && conversationId != null && (reply.startsWith("Non ho capito") || reply.startsWith("Ho trovato il cliente"))) {
        setPending(conversationId, toolCall, messageText);
      }
      return { success: !!dealId, reply, intent: "create_deal_command" };
    }

    case "createTask": {
      const { reply, taskId } = await createTaskFromMessage(messageText, runId, {
        title: sanitizeTitle(toolCall.args.title, messageText),
        description: toolCall.args.description as string | undefined,
        dueDate: toolCall.args.dueDate as string | undefined,
      });
      return { success: !!taskId, reply, intent: "create_task_command" };
    }

    case "startStaticSiteWorkflow": {
      const { reply, projectId } = await startStaticSiteWorkflow(messageText, runId);
      return { success: !!projectId, reply, intent: "start_static_site_workflow" };
    }

    case "generateAppForClient": {
      const { reply, projectId } = await generateAppForClient(messageText, runId);
      return { success: !!projectId, reply, intent: "generate_app_for_client" };
    }

    case "createContact": {
      try {
        const name = (toolCall.args.name as string) || extractNameFromText(messageText);
        if (!name) {
          if (conversationId != null) setPending(conversationId, toolCall, messageText);
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

    case "updateContact": {
      try {
        const name = (toolCall.args.name as string) || extractNameFromText(messageText);
        if (!name) {
          return {
            success: false,
            reply: "Non ho capito il nome del contatto da aggiornare. Prova con: 'Modifica contatto Mario Rossi temperatura warm'.",
            intent: "unknown",
          };
        }
        const contacts = await listContacts({ search: name });
        const contact = contacts.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (!contact) {
          return {
            success: false,
            reply: `Contatto "${name}" non trovato nel CRM.`,
            intent: "unknown",
          };
        }
        // Extract temperature from text as source of truth (handles negations like "non è freddo")
        const textTemperature = extractTemperatureFromText(messageText);
        const aiTemperature =
          toolCall.args.temperature !== undefined && toolCall.args.temperature !== ""
            ? parseTemperature(toolCall.args.temperature as string)
            : undefined;
        const finalTemperature = textTemperature !== null ? textTemperature : aiTemperature;

        const payload: Record<string, unknown> = {};
        if (finalTemperature !== undefined) payload.temperature = finalTemperature;
        if (toolCall.args.email !== undefined && toolCall.args.email !== "") payload.email = toolCall.args.email as string;
        if (toolCall.args.phone !== undefined && toolCall.args.phone !== "") payload.phone = toolCall.args.phone as string;
        if (toolCall.args.company !== undefined && toolCall.args.company !== "") payload.company = toolCall.args.company as string;

        // Filter out any undefined values that might have slipped through
        const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));

        if (Object.keys(cleanPayload).length === 0) {
          return {
            success: false,
            reply: `Trovato ${contact.name}, ma non ho capito cosa aggiornare. Prova con: "Modifica ${contact.name} temperatura caldo".`,
            intent: "unknown",
          };
        }

        const updated = await updateContact(contact.id, cleanPayload);
        return {
          success: true,
          reply: `Contatto aggiornato: *${updated.name}*\nTemperatura: ${updated.temperature || "non specificata"}\nID: ${updated.id}`,
          intent: "unknown",
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          reply: "Errore nell'aggiornamento contatto: " + msg,
          intent: "unknown",
        };
      }
    }

    case "deleteContact": {
      try {
        const name = (toolCall.args.name as string) || extractNameFromText(messageText);
        if (!name) {
          return { success: false, reply: "Non ho capito il nome del contatto da eliminare.", intent: "unknown" };
        }
        const contact = await findContactByName(name);
        if (!contact) {
          return { success: false, reply: `Contatto "${name}" non trovato.`, intent: "unknown" };
        }
        await deleteContact(contact.id);
        return { success: true, reply: `Contatto *${contact.name}* eliminato.`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nell'eliminazione contatto: " + msg, intent: "unknown" };
      }
    }

    case "listDeals": {
      try {
        const clientName = toolCall.args.clientName as string | undefined;
        let deals: import("@/types").DealWithContact[] = [];
        if (clientName) {
          const contact = await findContactByName(clientName);
          if (!contact) {
            return { success: false, reply: `Contatto "${clientName}" non trovato.`, intent: "unknown" };
          }
          deals = await listDeals({ contactId: contact.id });
        } else {
          deals = await listDeals();
        }
        if (deals.length === 0) {
          return { success: true, reply: "Nessun deal trovato.", intent: "unknown" };
        }
        const lines = deals.map((d) => `• ${d.title} — ${d.value ? (d.value / 100).toLocaleString("it-IT") + " €" : "0 €"} (${d.stage?.name || "senza fase"})`);
        return { success: true, reply: `Deal trovati (${deals.length}):\n${lines.join("\n")}`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nel caricamento deal: " + msg, intent: "unknown" };
      }
    }

    case "updateDeal": {
      try {
        const clientName = toolCall.args.clientName as string | undefined;
        if (!clientName) {
          return { success: false, reply: "Manca il nome del cliente.", intent: "unknown" };
        }
        const deal = await findDealByClientName(clientName);
        if (!deal) {
          return { success: false, reply: `Nessun deal trovato per "${clientName}".`, intent: "unknown" };
        }
        const payload: Record<string, unknown> = {};
        if (toolCall.args.value !== undefined) payload.value = (toolCall.args.value as number) * 100;
        if (toolCall.args.probability !== undefined) payload.probability = toolCall.args.probability as number;
        if (toolCall.args.expectedClose !== undefined) payload.expectedClose = toolCall.args.expectedClose as string;
        if (toolCall.args.notes !== undefined) payload.notes = toolCall.args.notes as string;
        const updated = await updateDeal(deal.id, payload);
        return { success: true, reply: `Deal aggiornato: *${updated.title}*\nImporto: ${(updated.value / 100).toLocaleString("it-IT")} €\nProbabilità: ${updated.probability ?? 0}%`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nell'aggiornamento deal: " + msg, intent: "unknown" };
      }
    }

    case "moveDeal": {
      try {
        const clientName = toolCall.args.clientName as string | undefined;
        const stageName = toolCall.args.stageName as string | undefined;
        if (!clientName || !stageName) {
          return { success: false, reply: "Manca il nome del cliente o della fase.", intent: "unknown" };
        }
        const deal = await findDealByClientName(clientName);
        if (!deal) {
          return { success: false, reply: `Nessun deal trovato per "${clientName}".`, intent: "unknown" };
        }
        const stages = await getStages();
        const stage = stages.find((s) => s.name.toLowerCase().includes(stageName.toLowerCase()));
        if (!stage) {
          return { success: false, reply: `Fase "${stageName}" non trovata. Fasi disponibili: ${stages.map((s) => s.name).join(", ")}.`, intent: "unknown" };
        }
        const updated = await updateDeal(deal.id, { stageId: stage.id });
        return { success: true, reply: `Deal *${updated.title}* spostato in fase *${stage.name}*.`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nello spostamento deal: " + msg, intent: "unknown" };
      }
    }

    case "deleteDeal": {
      try {
        const clientName = toolCall.args.clientName as string | undefined;
        if (!clientName) {
          return { success: false, reply: "Manca il nome del cliente.", intent: "unknown" };
        }
        const deal = await findDealByClientName(clientName);
        if (!deal) {
          return { success: false, reply: `Nessun deal trovato per "${clientName}".`, intent: "unknown" };
        }
        await deleteDeal(deal.id);
        return { success: true, reply: `Deal *${deal.title}* eliminato.`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nell'eliminazione deal: " + msg, intent: "unknown" };
      }
    }

    case "listProjects": {
      try {
        const clientName = toolCall.args.clientName as string | undefined;
        let projects = await listProjects();
        if (clientName) {
          const contact = await findContactByName(clientName);
          if (!contact) {
            return { success: false, reply: `Contatto "${clientName}" non trovato.`, intent: "unknown" };
          }
          projects = projects.filter((p) => p.contactId === contact.id);
        }
        if (projects.length === 0) {
          return { success: true, reply: "Nessun progetto trovato.", intent: "unknown" };
        }
        const lines = projects.map((p) => `• ${p.title} — ${p.status} (priorità: ${p.priority || "non specificata"})`);
        return { success: true, reply: `Progetti trovati (${projects.length}):\n${lines.join("\n")}`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nel caricamento progetti: " + msg, intent: "unknown" };
      }
    }

    case "updateProject": {
      try {
        const clientName = toolCall.args.clientName as string | undefined;
        if (!clientName) {
          return { success: false, reply: "Manca il nome del cliente.", intent: "unknown" };
        }
        const project = await findProjectByClientName(clientName);
        if (!project) {
          return { success: false, reply: `Nessun progetto trovato per "${clientName}".`, intent: "unknown" };
        }
        const payload: Record<string, unknown> = {};
        if (toolCall.args.status !== undefined) payload.status = toolCall.args.status as string;
        if (toolCall.args.priority !== undefined) payload.priority = toolCall.args.priority as string;
        if (toolCall.args.dueDate !== undefined) payload.dueDate = toolCall.args.dueDate as string;
        if (toolCall.args.notes !== undefined) payload.notes = toolCall.args.notes as string;
        const updated = await updateProject(project.id, payload);
        return { success: true, reply: `Progetto aggiornato: *${updated.title}*\nStato: ${updated.status}\nPriorità: ${updated.priority || "non specificata"}`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nell'aggiornamento progetto: " + msg, intent: "unknown" };
      }
    }

    case "deleteProject": {
      try {
        const clientName = toolCall.args.clientName as string | undefined;
        if (!clientName) {
          return { success: false, reply: "Manca il nome del cliente.", intent: "unknown" };
        }
        const project = await findProjectByClientName(clientName);
        if (!project) {
          return { success: false, reply: `Nessun progetto trovato per "${clientName}".`, intent: "unknown" };
        }
        await deleteProject(project.id);
        return { success: true, reply: `Progetto *${project.title}* eliminato.`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nell'eliminazione progetto: " + msg, intent: "unknown" };
      }
    }

    case "listTasks": {
      try {
        const tasks = await listTasks();
        if (tasks.length === 0) {
          return { success: true, reply: "Nessuna task trovata.", intent: "unknown" };
        }
        const lines = tasks.map((t) => `• ${t.title} ${t.done ? "✅" : ""} ${t.dueAt ? "(scadenza: " + new Date(t.dueAt).toLocaleDateString("it-IT") + ")" : ""}`);
        return { success: true, reply: `Task trovate (${tasks.length}):\n${lines.join("\n")}`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nel caricamento task: " + msg, intent: "unknown" };
      }
    }

    case "updateTask": {
      try {
        const titleKeyword = toolCall.args.titleKeyword as string | undefined;
        if (!titleKeyword) {
          return { success: false, reply: "Manca la parola chiave della task.", intent: "unknown" };
        }
        const task = await findTaskByKeyword(titleKeyword);
        if (!task) {
          return { success: false, reply: `Nessuna task trovata con "${titleKeyword}".`, intent: "unknown" };
        }
        const payload: Record<string, unknown> = {};
        if (toolCall.args.done !== undefined) payload.done = toolCall.args.done as boolean;
        if (toolCall.args.dueDate !== undefined) payload.dueAt = toolCall.args.dueDate as string;
        const updated = await updateTask(task.id, payload);
        return { success: true, reply: `Task aggiornata: *${updated.title}* ${updated.done ? "✅ completata" : ""}`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nell'aggiornamento task: " + msg, intent: "unknown" };
      }
    }

    case "deleteTask": {
      try {
        const titleKeyword = toolCall.args.titleKeyword as string | undefined;
        if (!titleKeyword) {
          return { success: false, reply: "Manca la parola chiave della task.", intent: "unknown" };
        }
        const task = await findTaskByKeyword(titleKeyword);
        if (!task) {
          return { success: false, reply: `Nessuna task trovata con "${titleKeyword}".`, intent: "unknown" };
        }
        await deleteTask(task.id);
        return { success: true, reply: `Task *${task.title}* eliminata.`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nell'eliminazione task: " + msg, intent: "unknown" };
      }
    }

    case "addActivity": {
      try {
        const clientName = toolCall.args.clientName as string | undefined;
        const description = toolCall.args.description as string | undefined;
        if (!clientName || !description) {
          return { success: false, reply: "Manca il nome del cliente o la descrizione dell'attività.", intent: "unknown" };
        }
        const contact = await findContactByName(clientName);
        if (!contact) {
          return { success: false, reply: `Contatto "${clientName}" non trovato.`, intent: "unknown" };
        }
        const type = (toolCall.args.type as string) || "nota";
        const activity = await createActivity({
          type,
          description,
          contactId: contact.id,
        });
        return { success: true, reply: `Attività aggiunta per *${contact.name}*:\n${activity.description}`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nell'aggiunta attività: " + msg, intent: "unknown" };
      }
    }

    case "listActivities": {
      try {
        const clientName = toolCall.args.clientName as string | undefined;
        if (!clientName) {
          return { success: false, reply: "Manca il nome del cliente.", intent: "unknown" };
        }
        const contact = await findContactByName(clientName);
        if (!contact) {
          return { success: false, reply: `Contatto "${clientName}" non trovato.`, intent: "unknown" };
        }
        const activities = await listActivities({ contactId: contact.id });
        if (activities.length === 0) {
          return { success: true, reply: `Nessuna attività trovata per ${contact.name}.`, intent: "unknown" };
        }
        const lines = activities.map((a) => `• [${a.type}] ${a.description}`);
        return { success: true, reply: `Attività di ${contact.name} (${activities.length}):\n${lines.join("\n")}`, intent: "unknown" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, reply: "Errore nel caricamento attività: " + msg, intent: "unknown" };
      }
    }

    case "done": {
      const replyMsg = (toolCall.args.message as string) || "";
      return { success: true, reply: replyMsg, intent: "unknown" };
    }

    case "reply": {
      let replyMsg = (toolCall.args.message as string) || "Non ho capito.";
      // If the reply is generic, append available commands list
      const genericReplies = ["Non ho capito.", "Non ho capito il comando.", "Non ho capito. Puoi ripetere?"];
      if (genericReplies.includes(replyMsg)) {
        replyMsg += "\n\nComandi disponibili:\n- A che progetti stiamo lavorando?\n- Quanti ricavi abbiamo fatto oggi?\n- Quali progetti sono bloccati?\n- Crea progetto per [cliente]\n- Crea deal per [cliente] da [importo]\n- Avvia workflow sito statico per [cliente]\n- Crea un'app per [cliente]";
      }
      // Save pending so the next user message is treated as clarification
      if (conversationId != null) {
        setPending(conversationId, toolCall, messageText);
      }
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
  // Pattern: "[Name] non è ..." or "[Name] è ..." (name before the verb)
  // Matches names starting with uppercase letter(s), e.g. "Riccardo Consuegra non è freddo"
  // Uses only flag 'u' so \p{Lu} truly matches uppercase letters (flag 'i' would make it case-insensitive).
  const nameFirstMatch = text.match(/(?:^|\s)(\p{Lu}[^\s,]*(?:\s+\p{Lu}[^\s,]*)*)\s+(?:[Nn]on\s+)?[èÈeE]/u);
  if (nameFirstMatch) {
    const candidate = nameFirstMatch[1].trim();
    if (candidate.toLowerCase() !== "non") return candidate;
  }

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

  // Handle negations: "non è freddo" -> warm, "non è tiepido" -> hot, "non è caldo" -> cold
  // Also: "neanche tiepido", "neppure freddo", "non è neanche caldo"
  const negMatch = t.match(/(?:non|neanche|neppure)\s+(?:è\s+|e\s+|sono\s+|siamo\s+)?(?:un\s+|una\s+)?(?:contatto\s+)?(fredd[oa]|tiepid[oa]|tibio|caldo|cold|warm|hot)/);
  if (negMatch) {
    const matched = negMatch[1];
    if (/fredd|cold/.test(matched)) return "warm";
    if (/tib|warm|tiepid/.test(matched)) return "hot";
    if (/cald|hot/.test(matched)) return "cold";
  }

  if (/caldo|hot/i.test(t)) return "hot";
  if (/tibio|warm|tiepid/i.test(t)) return "warm";
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
