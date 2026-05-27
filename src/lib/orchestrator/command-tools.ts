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

function extractAfterKeyword(text: string, keywords: string[]): string | null {
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

function extractAmount(text: string): number | null {
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

function extractClientName(text: string): string | null {
  // "per [Name]" or "per [Name] da" or "per [Name] -"
  const match = text.match(/per\s+([^\-—:,\d]+?)(?:\s+(?:da|con|-|—|:\s|$))/i);
  if (match) return match[1].trim().replace(/^["']+|["']+$/g, "");

  // Fallback: just "per [rest of line]"
  const fallback = text.match(/per\s+(.+)/i);
  if (fallback) return fallback[1].trim().replace(/^["']+|["']+$/g, "");

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
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
  },
): Promise<{ reply: string; projectId: string | null }> {
  const clientName = extractClientName(text);
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

  try {
    const contact = await findOrCreateContact(clientName);
    const project = await createProject({
      title,
      description,
      contactId: contact.id,
      status: status as import("@/types").ProjectStatus,
      priority,
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

    return {
      reply: "Progetto creato: *" + project.title + "*" + descNote + "\nID: " + project.id + contactNote,
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

function extractProbability(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*%/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val >= 0 && val <= 100) return val;
  }
  return null;
}

function extractExpectedClose(text: string): Date | null {
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

function parseExpectedClose(value: string | undefined): Date | null {
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
    title?: string;
    description?: string;
    probability?: number;
    expectedClose?: string;
  },
): Promise<{ reply: string; dealId: string | null }> {
  const clientName = extractClientName(text);
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
  const title = overrides?.title ?? desc ?? text;

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
      description: overrides?.description ?? desc ?? null,
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
