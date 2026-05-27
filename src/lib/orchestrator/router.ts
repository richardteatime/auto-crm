import { classifyIntent } from "./intents";
import { createRun, updateRun } from "./runs";
import { logWorkflowEvent } from "./logger";
import type { Intent, SenderRole } from "./types";
import { sendChatwootMessage } from "@/lib/chatwoot/client";
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

interface CommandInput {
  senderPhone: string | null;
  senderTelegramId: string | null;
  senderName: string | null;
  conversationId: number;
  messageText: string;
  source?: string;
}

interface CommandResult {
  success: boolean;
  runId: string | null;
  intent: Intent;
  reply: string;
  error?: string | null;
}

/**
 * Main orchestrator entry point.
 *
 * 1. Creates a run
 * 2. Classifies intent
 * 3. Routes to the right handler
 * 4. Updates run with result
 * 5. Returns reply
 *
 * Note: query execution (Phase 5) and command tools (Phase 6) implemented.
 */
export async function handleCommand(input: CommandInput): Promise<CommandResult> {
  const source = input.source ?? "chatwoot";

  // 1. Create run
  const run = await createRun({
    source,
    senderPhone: input.senderPhone,
    senderRole: "founder_admin", // already verified by permission layer
    commandText: input.messageText,
    status: "running",
    conversationId: String(input.conversationId),
  });

  const runId = run?.id ?? null;

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: "message_received",
    message: `Messaggio ricevuto da ${input.senderPhone || "sconosciuto"}`,
    metadata: {
      senderPhone: input.senderPhone,
      senderName: input.senderName,
      conversationId: input.conversationId,
      messageText: input.messageText,
    },
  });

  // 2. Classify intent
  let intent: Intent;
  try {
    intent = await classifyIntent(input.messageText);
  } catch {
    intent = "unknown";
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: "intent_classified",
    message: `Intent riconosciuto: ${intent}`,
    metadata: { intent, messageText: input.messageText },
  });

  if (runId) {
    await updateRun(runId, { intent });
  }

  // 3. Route to handler
  const result = await executeIntent(intent, input, runId);

  // 4. Update run with result
  if (runId) {
    await updateRun(runId, {
      status: result.success ? "completed" : "failed",
      resultSummary: result.reply.slice(0, 500),
      error: result.error ?? null,
    });
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: result.success ? "command_executed" : "error",
    message: result.reply.slice(0, 500),
    metadata: { intent, success: result.success, error: result.error },
  });

  // 5. Send reply via Chatwoot
  if (result.reply) {
    await sendChatwootMessage(input.conversationId, result.reply);
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: "reply_sent",
    message: "Risposta inviata su Chatwoot",
    metadata: { conversationId: input.conversationId },
  });

  return result;
}

// ---------------------------------------------------------------------------
// Intent execution
// ---------------------------------------------------------------------------

async function executeIntent(
  intent: Intent,
  input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  switch (intent) {
    case "project_status_query":
      return handleProjectStatusQuery(input, runId);
    case "revenue_today_query":
      return handleRevenueQuery(input, runId);
    case "lead_summary_query":
      return handleLeadSummaryQuery(input, runId);
    case "blocked_projects_query":
      return handleBlockedProjectsQuery(input, runId);
    case "agent_status_query":
      return handleAgentStatusQuery(input, runId);
    case "deployment_status_query":
      return handleDeploymentStatusQuery(input, runId);
    case "tasks_query":
      return handleTasksQuery(input, runId);
    case "create_project_command":
      return handleCreateProject(input, runId);
    case "create_deal_command":
      return handleCreateDeal(input, runId);
    case "create_task_command":
      return handleCreateTask(input, runId);
    case "start_static_site_workflow":
      return handleStartStaticSiteWorkflow(input, runId);
    case "generate_app_for_client":
      return handleGenerateApp(input, runId);
    case "unknown":
    default:
      return handleUnknown(input, runId);
  }
}

// Query handlers (Phase 5)

async function handleProjectStatusQuery(
  _input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  try {
    const reply = await getActiveProjects();
    return { success: true, runId, intent: "project_status_query", reply };
  } catch (err) {
    return {
      success: false,
      runId,
      intent: "project_status_query",
      reply: "Errore nel caricamento progetti.",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleRevenueQuery(
  _input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  try {
    const reply = await getTodayRevenue();
    return { success: true, runId, intent: "revenue_today_query", reply };
  } catch (err) {
    return {
      success: false,
      runId,
      intent: "revenue_today_query",
      reply: "Errore nel caricamento ricavi.",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleLeadSummaryQuery(
  _input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  try {
    const reply = await getLeadSummary();
    return { success: true, runId, intent: "lead_summary_query", reply };
  } catch (err) {
    return {
      success: false,
      runId,
      intent: "lead_summary_query",
      reply: "Errore nel caricamento lead.",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleBlockedProjectsQuery(
  _input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  try {
    const reply = await getBlockedProjects();
    return { success: true, runId, intent: "blocked_projects_query", reply };
  } catch (err) {
    return {
      success: false,
      runId,
      intent: "blocked_projects_query",
      reply: "Errore nel caricamento progetti bloccati.",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleAgentStatusQuery(
  _input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  try {
    const reply = await getAgentStatus();
    return { success: true, runId, intent: "agent_status_query", reply };
  } catch (err) {
    return {
      success: false,
      runId,
      intent: "agent_status_query",
      reply: "Errore nel caricamento stato agenti.",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleDeploymentStatusQuery(
  _input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  try {
    const reply = await getDeploymentStatus();
    return { success: true, runId, intent: "deployment_status_query", reply };
  } catch (err) {
    return {
      success: false,
      runId,
      intent: "deployment_status_query",
      reply: "Errore nel caricamento stato deploy.",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handleTasksQuery(
  _input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  try {
    const reply = await getMyTasksToday();
    return { success: true, runId, intent: "tasks_query", reply };
  } catch (err) {
    return {
      success: false,
      runId,
      intent: "tasks_query",
      reply: "Errore nel caricamento task.",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Command handlers (Phase 6)

async function handleCreateProject(
  input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  const { reply, projectId } = await createProjectFromMessage(input.messageText, runId);
  return {
    success: !!projectId,
    runId,
    intent: "create_project_command",
    reply,
  };
}

async function handleCreateDeal(
  input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  const { reply, dealId } = await createDealFromMessage(input.messageText, runId);
  return {
    success: !!dealId,
    runId,
    intent: "create_deal_command",
    reply,
  };
}

async function handleCreateTask(
  input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  const { reply, taskId } = await createTaskFromMessage(input.messageText, runId);
  return {
    success: !!taskId,
    runId,
    intent: "create_task_command",
    reply,
  };
}

// Workflow handlers (Phase 7)

async function handleStartStaticSiteWorkflow(
  input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  const { reply, projectId } = await startStaticSiteWorkflow(input.messageText, runId);
  return {
    success: !!projectId,
    runId,
    intent: "start_static_site_workflow",
    reply,
  };
}

async function handleGenerateApp(
  input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  const { reply, projectId } = await generateAppForClient(input.messageText, runId);
  return {
    success: !!projectId,
    runId,
    intent: "generate_app_for_client",
    reply,
  };
}

// Unknown handler

async function handleUnknown(
  _input: CommandInput,
  runId: string | null,
): Promise<CommandResult> {
  return {
    success: true,
    runId,
    intent: "unknown",
    reply: `Non ho capito il comando.

Comandi disponibili:
- A che progetti stiamo lavorando?
- Quanti ricavi abbiamo fatto oggi?
- Quali progetti sono bloccati?
- Cosa devo fare oggi?
- Crea progetto per [cliente]
- Crea deal per [cliente] da [importo]
- Crea task [descrizione]
- Avvia workflow sito statico per [cliente]
- Crea un'app per [cliente]`,
  };
}
