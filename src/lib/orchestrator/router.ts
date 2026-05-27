import { createRun, updateRun } from "./runs";
import { logWorkflowEvent } from "./logger";
import type { Intent } from "./types";
import { sendChatwootMessage } from "@/lib/chatwoot/client";
import { checkMessagePermission } from "./permissions";
import { chooseTool, executeTool } from "./tools";

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
 * Main orchestrator entry point — tool-use pattern.
 *
 * 1. Creates a run
 * 2. AI chooses which tool to call (no fixed intents)
 * 3. Executes the tool
 * 4. Updates run with result
 * 5. Returns reply
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

  // 2. AI chooses tool
  let toolCall;
  try {
    toolCall = await chooseTool(input.messageText, input.conversationId);
  } catch {
    toolCall = { tool: "reply", args: { message: "Non ho capito il comando." } };
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: "intent_classified",
    message: `Tool scelto: ${toolCall.tool}`,
    metadata: { tool: toolCall.tool, args: toolCall.args, messageText: input.messageText },
  });

  if (runId) {
    await updateRun(runId, { intent: toolCall.tool });
  }

  // 3. Execute tool
  const result = await executeTool(toolCall, input.messageText, runId);

  // 4. Update run with result
  if (runId) {
    await updateRun(runId, {
      status: result.success ? "completed" : "failed",
      resultSummary: result.reply.slice(0, 500),
      error: null,
    });
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: result.success ? "command_executed" : "error",
    message: result.reply.slice(0, 500),
    metadata: { tool: toolCall.tool, success: result.success },
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

  return {
    success: result.success,
    runId,
    intent: result.intent,
    reply: result.reply,
  };
}
