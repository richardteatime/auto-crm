import { createProject } from "@/lib/db/projects";
import { createDeal } from "@/lib/db/deals";
import { createTask } from "@/lib/db/tasks";
import { createContact, listContacts } from "@/lib/db/contacts";
import { getStages } from "@/lib/db/pipeline";
import { updateRun } from "@/lib/orchestrator/runs";
import { logWorkflowEvent } from "@/lib/orchestrator/logger";
import { formatCurrency } from "@/lib/constants";
import {
  isGitAgentConfigured,
  dispatchToGitAgent,
  buildGitAgentPayload,
} from "@/lib/orchestrator/dispatchers/gitagent";

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

export function extractAfterKeyword(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) {
      const after = text.slice(idx + kw.length).trim();
      // Strip leading punctuation
      return after.replace(/^[:\-\s]+/, "").trim() || null;
    }
  }
  return null;
}

export function extractAmount(text: string): number | null {
  // Match patterns like "5000", "5.000", "5,000", "5k", "5000 euro"
  const match = text.match(/(\d[\d.\s,]*)(?:\s*(?:k|eur[o?]|€|\$))?/i);
  if (!match) return null;

  let raw = match[1]
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "");

  // Handle "5k" shorthand
  const hasK = /\d\s*k/i.test(text);
  const val = parseInt(raw, 10);
  if (Number.isNaN(val)) return null;

  return hasK ? val * 1000 : val;
}

export function extractClientName(text: string): string | null {
  // Word-boundary aware terminators to avoid matching inside names (e.g. "da" in "Azienda")
  const terminators = String.raw`[\,\.\-—]|:\s|\bda\b(?:\s|$)|\bcon\b(?:\s|$)|\bentro\b(?:\s|$)|\bpriorit[aà](?:\s|$)|\bper\b(?:\s|$)|$`;
  const match = text.match(new RegExp(String.raw`per\s+([^\-—:,\.\d]+?)(?:\s*(?:${terminators}))`, "i"));
  if (match) {
    const name = match[1].trim().replace(/^["']+|["']+$/g, "");
    if (name) return name;
  }

  // Fallback: everything after "per" but truncate aggressively
  const fallback = text.match(/per\s+(.+)/i);
  if (fallback) {
    let name = fallback[1].trim().replace(/^["']+|["']+$/g, "");
    const truncateMatch = name.match(new RegExp(String.raw`^([^,\.—\-]+?)(?:\s*(?:${terminators}))`, "i"));
    if (truncateMatch) name = truncateMatch[1].trim();
    // Hard cap at 40 chars
    if (name.length > 40) name = name.slice(0, 40).trim();
    return name;
  }

  return null;
}

export function parseItalianDate(value: string | undefined): Date | null {
  if (!value) return null;
  const lower = value.toLowerCase();

  if (lower.includes("domani")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  if (lower.includes("oggi")) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }

  // Match dd/mm or dd/mm/yyyy
  const ddMmMatch = value.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (ddMmMatch) {
    const day = parseInt(ddMmMatch[1], 10);
    const month = parseInt(ddMmMatch[2], 10) - 1;
    const year = ddMmMatch[3] ? parseInt(ddMmMatch[3], 10) : new Date().getFullYear();
    const d = new Date(year, month, day, 12, 0, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Match "29 maggio" or "29 maggio 2026"
  const monthNames: Record<string, number> = {
    gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
    luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
    gen: 0, feb: 1, mar: 2, apr: 3, mag: 4, giu: 5, lug: 6, ago: 7, set: 8, ott: 9, nov: 10, dic: 11,
  };
  const textMatch = value.match(/(\d{1,2})\s+([a-zèé]+)(?:\s+(\d{4}))?/i);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthName = textMatch[2].toLowerCase();
    const year = textMatch[3] ? parseInt(textMatch[3], 10) : new Date().getFullYear();
    const month = monthNames[monthName];
    if (month !== undefined) {
      const d = new Date(year, month, day, 12, 0, 0, 0);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  return null;
}

export function extractDueDate(text: string): Date | null {
  const lower = text.toLowerCase();

  if (lower.includes("domani")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  if (lower.includes("oggi")) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }

  // Match "entro il 29/05" or "entro 29/05"
  const ddMmMatch = text.match(/entro\s+(?:il\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/i);
  if (ddMmMatch) {
    return parseItalianDate(ddMmMatch[1]);
  }

  // Match "entro venerdì 29 maggio" or "entro il 29 maggio"
  const textMatch = text.match(/entro\s+(?:il\s+|venerd[iì]\s+|luned[iì]\s+|marted[iì]\s+|mercoled[iì]\s+|gioved[iì]\s+|sabato\s+|domenica\s+)?(\d{1,2}\s+[a-zèé]+(?:\s+\d{4})?)/i);
  if (textMatch) {
    return parseItalianDate(textMatch[1]);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Contact resolution
// ---------------------------------------------------------------------------

async function findOrCreateContact(name: string): Promise<{ id: string; name: string; isNew: boolean }> {
  const contacts = await listContacts({ search: name });
  const exact = contacts.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (exact) return { id: exact.id, name: exact.name, isNew: false };

  // No fuzzy match: if not exact, always create new to avoid wrong associations
  const created = await createContact({ name, source: "webhook" });
  return { id: created.id, name: created.name, isNew: true };
}

// ---------------------------------------------------------------------------
// Command: create project
// ---------------------------------------------------------------------------

export async function createProjectFromMessage(
  text: string,
  runId: string | null,
  overrides?: {
    clientName?: string;
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
  },
): Promise<{ reply: string; projectId: string | null }> {
  const clientName = overrides?.clientName ?? extractClientName(text);
  if (!clientName) {
    return {
      reply: "Non ho capito per quale cliente creare il progetto. Riprova con: 'Crea progetto per [cliente]'.",
      projectId: null,
    };
  }

  // Use AI-extracted title if available, otherwise extract from text
  let title = overrides?.title;
  if (!title) {
    title = extractAfterKeyword(text, ["progetto per " + clientName, "progetto per " + clientName.toLowerCase(), "-", "-"]) ?? ("Progetto per " + clientName);
    title = title.replace(/^per\s+/i, "").trim();
    if (!title || title.toLowerCase() === clientName.toLowerCase()) {
      title = "Progetto per " + clientName;
    }
  }

  const description = overrides?.description ?? null;
  const status = overrides?.status ?? "aperto";
  const priority = overrides?.priority ?? "media";
  const dueDate = overrides?.dueDate
    ? parseItalianDate(overrides.dueDate)
    : extractDueDate(text) ?? undefined;

  try {
    const contact = await findOrCreateContact(clientName);
    const project = await createProject({
      title,
      description,
      contactId: contact.id,
      status: status as import("@/types").ProjectStatus,
      priority,
      dueDate,
    });

    await logWorkflowEvent({
      runId: runId ?? undefined,
      eventType: "project_created",
      message: "Progetto creato: " + project.title,
      metadata: { projectId: project.id, contactId: contact.id, contactName: contact.name },
    });

    if (runId) {
      await updateRun(runId, { projectId: project.id });
    }

    const contactNote = contact.isNew
      ? " (contatto " + contact.name + " creato automaticamente)"
      : " (contatto: " + contact.name + ")";

    const descNote = description ? "\nDescrizione: " + description : "";
    const dueNote = project.dueDate ? "\nScadenza: " + new Date(project.dueDate).toLocaleDateString("it-IT") : "";

    return {
      reply: "Progetto creato: *" + project.title + "*" + descNote + dueNote + "\nID: " + project.id + contactNote,
      projectId: project.id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { reply: "Errore nella creazione progetto: " + msg, projectId: null };
  }
}

// ---------------------------------------------------------------------------
// Extraction helpers for deals
// ---------------------------------------------------------------------------

export function extractProbability(text: string): number | null {
  const match = text.match(/(?<![\d.])(\d{1,3})\s*%/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val >= 0 && val <= 100) return val;
  }
  return null;
}

export function extractExpectedClose(text: string): Date | null {
  // Match formats: "20/06", "20/06/2026", "entro il 20/06"
  const ddMmMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (ddMmMatch) {
    const day = parseInt(ddMmMatch[1], 10);
    const month = parseInt(ddMmMatch[2], 10) - 1;
    const year = ddMmMatch[3] ? parseInt(ddMmMatch[3], 10) : new Date().getFullYear();
    const date = new Date(year, month, day, 12, 0, 0, 0);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export function parseExpectedClose(value: string | undefined): Date | null {
  if (!value) return null;
  const ddMmMatch = value.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (ddMmMatch) {
    const day = parseInt(ddMmMatch[1], 10);
    const month = parseInt(ddMmMatch[2], 10) - 1;
    const year = ddMmMatch[3] ? parseInt(ddMmMatch[3], 10) : new Date().getFullYear();
    const date = new Date(year, month, day, 12, 0, 0, 0);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Command: create deal
// ---------------------------------------------------------------------------

export async function createDealFromMessage(
  text: string,
  runId: string | null,
  overrides?: {
    clientName?: string;
    title?: string;
    description?: string;
    probability?: number;
    expectedClose?: string;
  },
): Promise<{ reply: string; dealId: string | null }> {
  const clientName = overrides?.clientName ?? extractClientName(text);
  if (!clientName) {
    return {
      reply: "Non ho capito per quale cliente creare il deal. Riprova con: 'Crea deal per [cliente] da [importo]'.",
      dealId: null,
    };
  }

  const amount = extractAmount(text);
  if (!amount) {
    return {
      reply: "Ho trovato il cliente (" + clientName + ") ma non l'importo. Riprova con: 'Crea deal per " + clientName + " da 5000 euro'.",
      dealId: null,
    };
  }

  try {
    const stages = await getStages();
    const firstStage = stages[0];
    if (!firstStage) {
      return {
        reply: "Errore: non ho trovato nessuna fase nel pipeline. Configura il pipeline prima di creare deal.",
        dealId: null,
      };
    }

    const contact = await findOrCreateContact(clientName);
    const title = overrides?.title ?? ("Deal per " + contact.name);
    const probability = overrides?.probability ?? extractProbability(text) ?? undefined;
    const expectedClose = overrides?.expectedClose
      ? parseExpectedClose(overrides.expectedClose)
      : extractExpectedClose(text) ?? undefined;

    const deal = await createDeal({
      title,
      value: amount * 100, // convert to cents
      contactId: contact.id,
      stageId: firstStage.id,
      notes: overrides?.description ?? null,
      probability,
      expectedClose,
    });

    await logWorkflowEvent({
      runId: runId ?? undefined,
      eventType: "deal_created",
      message: "Deal creato: " + deal.title + " - " + formatCurrency(deal.value),
      metadata: { dealId: deal.id, contactId: contact.id, value: deal.value, probability, expectedClose },
    });

    if (runId) {
      await updateRun(runId, { dealId: deal.id });
    }

    const contactNote = contact.isNew
      ? " (contatto creato automaticamente)"
      : " (contatto: " + contact.name + ")";

    const probNote = probability !== undefined ? "\nProbabilità: " + probability + "%" : "";
    const closeNote = expectedClose ? "\nChiusura stimata: " + expectedClose.toLocaleDateString("it-IT") : "";

    return {
      reply: "Deal creato: *" + deal.title + "*\nImporto: " + formatCurrency(deal.value) + probNote + closeNote + "\nFase: " + firstStage.name + contactNote,
      dealId: deal.id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { reply: "Errore nella creazione deal: " + msg, dealId: null };
  }
}

// ---------------------------------------------------------------------------
// Command: create task
// ---------------------------------------------------------------------------

export async function createTaskFromMessage(
  text: string,
  runId: string | null,
  overrides?: {
    title?: string;
    description?: string;
    dueDate?: string;
  },
): Promise<{ reply: string; taskId: string | null }> {
  // Extract description: everything after "task" or "task:"
  const desc = extractAfterKeyword(text, ["crea task", "task", "nuovo task"]);
  let title = overrides?.title ?? desc ?? text;
  let description = overrides?.description ?? desc ?? null;

  // Pattern: "per/di/da Nome - azione" -> prendi solo l'azione
  if (title && !overrides?.title) {
    const m = title.match(/^(?:per|di|da)\s+[^-–—]+\s*[-–—]\s*(.+)/i);
    if (m) {
      title = m[1].trim();
    }
  }

  // Auto-truncate long titles: max 6 words, move rest to description
  if (title) {
    const words = title.split(/\s+/);
    if (words.length > 6) {
      const shortTitle = words.slice(0, 6).join(" ");
      const rest = words.slice(6).join(" ");
      description = description ? `${rest} — ${description}` : rest;
      title = shortTitle;
    }
  }

  // Try to extract a date keyword like "domani", "oggi", "tra 3 giorni"
  let dueAt: Date | null = null;
  const lower = text.toLowerCase();
  if (lower.includes("domani")) {
    dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 1);
    dueAt.setHours(9, 0, 0, 0);
  } else if (lower.includes("oggi")) {
    dueAt = new Date();
    dueAt.setHours(18, 0, 0, 0);
  } else {
    const daysMatch = lower.match(/tra\s+(\d+)\s+giorn/i);
    if (daysMatch) {
      dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + parseInt(daysMatch[1], 10));
      dueAt.setHours(9, 0, 0, 0);
    }
  }

  // If AI extracted a dueDate like "domani", convert it
  if (overrides?.dueDate) {
    const od = overrides.dueDate.toLowerCase();
    if (od.includes("domani")) {
      dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 1);
      dueAt.setHours(9, 0, 0, 0);
    } else if (od.includes("oggi")) {
      dueAt = new Date();
      dueAt.setHours(18, 0, 0, 0);
    }
  }

  try {
    const task = await createTask({
      title,
      description,
      dueAt,
    });

    await logWorkflowEvent({
      runId: runId ?? undefined,
      eventType: "task_created",
      message: "Task creato: " + task.title,
      metadata: { taskId: task.id, dueAt: task.dueAt?.toISOString() },
    });

    const dueNote = task.dueAt
      ? "\nScadenza: " + task.dueAt.toLocaleDateString("it-IT")
      : "";

    return {
      reply: "Task creato: *" + task.title + "*" + dueNote + "\nID: " + task.id,
      taskId: task.id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { reply: "Errore nella creazione task: " + msg, taskId: null };
  }
}

// ---------------------------------------------------------------------------
// Command: start static site workflow
// ---------------------------------------------------------------------------

export async function startStaticSiteWorkflow(
  text: string,
  runId: string | null,
): Promise<{ reply: string; projectId: string | null }> {
  // Reuse project creation logic, then flag as workflow
  const result = await createProjectFromMessage(text, runId);

  if (!result.projectId) {
    return result;
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: "workflow_started",
    message: "Workflow sito statico avviato",
    metadata: { workflow: "static_site", projectId: result.projectId },
  });

  if (!runId) {
    return {
      reply: result.reply + "\n\nWorkflow creato ma runId mancante - dispatch non possibile.",
      projectId: result.projectId,
    };
  }

  // Try to dispatch to GitAgent if enabled
  if (isGitAgentConfigured()) {
    const payload = buildGitAgentPayload({
      runId,
      workflow: "static_site",
      projectId: result.projectId,
      contactId: null,
      clientName: extractClientName(text),
      appType: "static_site",
      stack: "html_php_admin",
      autodeploy: true,
      riskLevel: "low",
    });

    const dispatch = await dispatchToGitAgent(payload);

    if (dispatch.success) {
      return {
        reply: result.reply + "\n\nWorkflow sito statico avviato e GitAgent dispacciato con successo.",
        projectId: result.projectId,
      };
    }

    return {
      reply: result.reply + "\n\nWorkflow creato ma GitAgent dispatch fallito: " + dispatch.error,
      projectId: result.projectId,
    };
  }

  // GitAgent disabled - queue for later
  await updateRun(runId, {
    workflow: "static_site",
    status: "pending_dispatch",
    currentStep: "waiting_for_gitagent",
  });

  return {
    reply: result.reply + "\n\nWorkflow sito statico avviato e messo in coda per il dispacciamento GitAgent (attualmente disabilitato).",
    projectId: result.projectId,
  };
}

// ---------------------------------------------------------------------------
// Command: generate app for client
// ---------------------------------------------------------------------------

export async function generateAppForClient(
  text: string,
  runId: string | null,
): Promise<{ reply: string; projectId: string | null; dealId: string | null }> {
  // Create project first
  const projectResult = await createProjectFromMessage(text, runId);
  if (!projectResult.projectId) {
    return { reply: projectResult.reply, projectId: null, dealId: null };
  }

  // Then create a deal for the app
  const clientName = extractClientName(text);
  let dealResult: { reply: string; dealId: string | null } = { reply: "", dealId: null };

  if (clientName) {
    // Create a deal with default app value (will be refined later)
    try {
      const stages = await getStages();
      const firstStage = stages[0];
      if (firstStage) {
        const contacts = await listContacts({ search: clientName });
        const contact = contacts.find((c) => c.name.toLowerCase() === clientName.toLowerCase()) ?? contacts[0];
        if (contact) {
          const deal = await createDeal({
            title: "App per " + contact.name,
            value: 0,
            contactId: contact.id,
            stageId: firstStage.id,
          });
          dealResult = { reply: "Deal creato: " + deal.title, dealId: deal.id };

          await logWorkflowEvent({
            runId: runId ?? undefined,
            eventType: "deal_created",
            message: "Deal app creato: " + deal.title,
            metadata: { dealId: deal.id, projectId: projectResult.projectId },
          });

          if (runId) {
            await updateRun(runId, { dealId: deal.id });
          }
        }
      }
    } catch {
      // Non-blocking: deal creation is secondary
    }
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: "workflow_started",
    message: "Workflow generazione app avviato",
    metadata: { workflow: "generate_app", projectId: projectResult.projectId },
  });

  if (!runId) {
    const dealNote = dealResult.dealId ? "\n" + dealResult.reply : "";
    return {
      reply: projectResult.reply + dealNote + "\n\nWorkflow creato ma runId mancante - dispatch non possibile.",
      projectId: projectResult.projectId,
      dealId: dealResult.dealId,
    };
  }

  // Try to dispatch to GitAgent if enabled
  if (isGitAgentConfigured()) {
    const clientName = extractClientName(text);
    let contactId: string | null = null;
    try {
      const contacts = await listContacts({ search: clientName || "" });
      const contact = contacts.find((c) => c.name.toLowerCase() === (clientName || "").toLowerCase()) ?? contacts[0];
      contactId = contact?.id ?? null;
    } catch {
      // ignore
    }

    const payload = buildGitAgentPayload({
      runId,
      workflow: "generate_app",
      projectId: projectResult.projectId,
      contactId,
      clientName,
      appType: "webapp",
      stack: "nextjs",
      autodeploy: true,
      riskLevel: "low",
    });

    const dispatch = await dispatchToGitAgent(payload);

    const dealNote = dealResult.dealId ? "\n" + dealResult.reply : "";

    if (dispatch.success) {
      return {
        reply: projectResult.reply + dealNote + "\n\nWorkflow generazione app avviato e GitAgent dispacciato con successo.",
        projectId: projectResult.projectId,
        dealId: dealResult.dealId,
      };
    }

    return {
      reply: projectResult.reply + dealNote + "\n\nWorkflow creato ma GitAgent dispatch fallito: " + dispatch.error,
      projectId: projectResult.projectId,
      dealId: dealResult.dealId,
    };
  }

  // GitAgent disabled - queue for later
  await updateRun(runId, {
    workflow: "generate_app",
    status: "pending_dispatch",
    currentStep: "waiting_for_gitagent",
  });

  const dealNote = dealResult.dealId ? "\n" + dealResult.reply : "";

  return {
    reply: projectResult.reply + dealNote + "\n\nWorkflow generazione app avviato e messo in coda per il dispacciamento GitAgent (attualmente disabilitato).",
    projectId: projectResult.projectId,
    dealId: dealResult.dealId,
  };
}
