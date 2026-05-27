import { createRun, updateRun } from "./runs";
import { logWorkflowEvent } from "./logger";
import type { Intent } from "./types";
import { sendChatwootMessage } from "@/lib/chatwoot/client";
import { checkMessagePermission } from "./permissions";
import { chooseTool, chooseNextTool, executeTool } from "./tools";

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
const MAX_TOOL_STEPS = 3;

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

  // 2-3. Multi-tool loop
  const executedSteps: Array<{ tool: string; result: string }> = [];
  const replies: string[] = [];
  let finalTool = "";
  let allSuccess = true;

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    let toolCall;
    try {
      if (step === 0) {
        toolCall = await chooseTool(input.messageText, input.conversationId);
      } else {
        toolCall = await chooseNextTool(input.messageText, executedSteps, input.conversationId);
      }
    } catch {
      toolCall = { tool: "reply", args: { message: "Non ho capito il comando." } };
    }

    await logWorkflowEvent({
      runId: runId ?? undefined,
      eventType: "intent_classified",
      message: `Tool scelto: ${toolCall.tool}`,
      metadata: { tool: toolCall.tool, args: toolCall.args, messageText: input.messageText },
    });

    if (runId && step === 0) {
      await updateRun(runId, { intent: toolCall.tool });
    }

    // done = end loop without executing
    if (toolCall.tool === "done") {
      const msg = (toolCall.args.message as string) || "";
      if (msg) replies.push(msg);
      finalTool = finalTool || "done";
      break;
    }

    const result = await executeTool(toolCall, input.messageText, runId, input.conversationId);
    executedSteps.push({ tool: toolCall.tool, result: result.reply });
    if (result.reply) replies.push(result.reply);
    if (!result.success) allSuccess = false;
    finalTool = toolCall.tool;

    // If it's a reply or failed, stop here
    if (toolCall.tool === "reply" || !result.success) {
      break;
    }
  }

  const finalReply = replies.filter(Boolean).join("\n\n");

  // 4. Update run with result
  if (runId) {
    await updateRun(runId, {
      status: allSuccess ? "completed" : "failed",
      resultSummary: finalReply.slice(0, 500),
      error: null,
    });
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: allSuccess ? "command_executed" : "error",
    message: finalReply.slice(0, 500),
    metadata: { tool: finalTool, success: allSuccess },
  });

  // 5. Send reply via Chatwoot
  if (finalReply) {
    await sendChatwootMessage(input.conversationId, finalReply);
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: "reply_sent",
    message: "Risposta inviata su Chatwoot",
    metadata: { conversationId: input.conversationId },
  });

  return {
    success: allSuccess,
    runId,
    intent: "unknown",
    reply: finalReply,
  };
}
