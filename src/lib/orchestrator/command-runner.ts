import type { Intent, RiskLevel, RunStatus, SenderRole } from "./types";
import { createRun, updateRun } from "./runs";
import { logWorkflowEvent } from "./logger";
import { chooseTool, chooseNextTool, executeTool, type ToolCall } from "./tools";
import type { CrmOperator } from "@/lib/crm-operators/types";
import {
  authorizeCrmTool,
  requiresCrmToolConfirmation,
} from "@/lib/crm-operators/policy";
import {
  createCommandConfirmation,
  getPendingCommandConfirmationByCode,
  markCommandConfirmationCancelled,
  markCommandConfirmationExecuted,
} from "@/lib/db/command-confirmations";

export interface CrmCommandInput {
  source: "telegram" | "chatwoot" | string;
  senderPhone: string | null;
  senderTelegramId: string | null;
  senderName: string | null;
  senderRole: SenderRole;
  operator?: CrmOperator | null;
  operatorId?: string | null;
  operatorRole?: string | null;
  conversationId: string;
  messageText: string;
}

export interface CrmCommandResult {
  success: boolean;
  runId: string | null;
  intent: Intent;
  reply: string;
  error?: string | null;
  confirmation?: {
    code: string;
    tool: string;
    riskLevel: RiskLevel;
  } | null;
}

const MAX_TOOL_STEPS = 3;

type ConfirmationAction = "confirm" | "cancel";

function toConversationNumber(conversationId: string): number | undefined {
  const parsed = Number(conversationId);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function currentOperatorId(input: CrmCommandInput): string | null {
  return input.operatorId ?? input.operator?.id ?? null;
}

function currentOperatorRole(input: CrmCommandInput): string | null {
  return input.operatorRole ?? input.operator?.role ?? null;
}

function parseConfirmationAction(messageText: string): {
  action: ConfirmationAction;
  code: string;
} | null {
  const text = messageText.trim();
  const match = text.match(/^(conferma|confirm|annulla|cancel|cancella)\s+([a-z0-9]{4,12})$/i);
  if (!match) return null;

  const verb = match[1].toLowerCase();
  return {
    action: verb === "conferma" || verb === "confirm" ? "confirm" : "cancel",
    code: match[2].toUpperCase(),
  };
}

function riskLabel(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "critical":
      return "CRITICO";
    case "high":
      return "ALTO";
    case "medium":
      return "MEDIO";
    case "low":
      return "BASSO";
  }
}

function buildConfirmationReply(params: {
  tool: string;
  riskLevel: RiskLevel;
  code: string;
  expiresAt: Date;
}): string {
  return [
    "⚠️ Serve conferma prima di eseguire questa modifica.",
    "",
    `Azione: ${params.tool}`,
    `Rischio: ${riskLabel(params.riskLevel)}`,
    `Scade: ${params.expiresAt.toLocaleString("it-IT")}`,
    "",
    `Premi un bottone qui sotto, oppure scrivi: CONFERMA ${params.code}`,
    `Per annullare: ANNULLA ${params.code}`,
  ].join("\n");
}

async function handleConfirmationAction(
  input: CrmCommandInput,
  runId: string | null,
  conversationNumber: number | undefined,
  action: { action: ConfirmationAction; code: string },
): Promise<CrmCommandResult> {
  const confirmation = await getPendingCommandConfirmationByCode({
    source: input.source,
    conversationId: input.conversationId,
    confirmationCode: action.code,
    operatorId: currentOperatorId(input),
    senderTelegramId: input.senderTelegramId,
  }).catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[command-runner] failed to read confirmation:", errorMessage);
    return null;
  });

  if (!confirmation) {
    const reply = `Non trovo una conferma pendente con codice ${action.code}. Potrebbe essere scaduta o già gestita.`;
    if (runId) {
      await updateRun(runId, {
        status: "failed",
        resultSummary: reply,
        error: reply,
      });
    }
    return {
      success: false,
      runId,
      intent: "unknown",
      reply,
      error: reply,
      confirmation: null,
    };
  }

  if (action.action === "cancel") {
    await markCommandConfirmationCancelled(confirmation.id);
    const reply = `Operazione annullata: ${confirmation.toolName}.`;
    if (runId) {
      await updateRun(runId, {
        status: "cancelled",
        resultSummary: reply,
        error: null,
      });
    }
    await logWorkflowEvent({
      runId: runId ?? undefined,
      eventType: "permission_checked",
      message: "Conferma comando annullata",
      metadata: {
        confirmationId: confirmation.id,
        confirmationCode: confirmation.confirmationCode,
        tool: confirmation.toolName,
        source: input.source,
        operatorId: currentOperatorId(input),
      },
    });
    return { success: true, runId, intent: "unknown", reply };
  }

  const toolCall: ToolCall = {
    tool: confirmation.toolName,
    args: confirmation.toolArgs,
  };

  const authorization = authorizeCrmTool({
    tool: toolCall.tool,
    senderRole: input.senderRole,
    operator: input.operator ?? null,
  });

  if (!authorization.allowed) {
    const reply = authorization.reason ?? "Non hai più il permesso per eseguire questo comando.";
    if (runId) {
      await updateRun(runId, {
        status: "unauthorized",
        resultSummary: reply,
        error: reply,
      });
    }
    return { success: false, runId, intent: "unknown", reply, error: reply };
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: "permission_checked",
    message: "Conferma comando accettata",
    metadata: {
      confirmationId: confirmation.id,
      confirmationCode: confirmation.confirmationCode,
      tool: confirmation.toolName,
      riskLevel: confirmation.riskLevel,
      source: input.source,
      operatorId: currentOperatorId(input),
    },
  });

  const result = await executeTool(
    toolCall,
    confirmation.commandText,
    runId,
    conversationNumber,
  );

  await markCommandConfirmationExecuted(confirmation.id, {
    executedRunId: runId,
    resultSummary: result.reply.slice(0, 500),
  });

  if (runId) {
    await updateRun(runId, {
      status: result.success ? "completed" : "failed",
      intent: toolCall.tool,
      riskLevel: confirmation.riskLevel,
      resultSummary: result.reply.slice(0, 500),
      error: result.success ? null : result.reply,
    });
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: result.success ? "command_executed" : "error",
    message: result.reply.slice(0, 500),
    metadata: {
      confirmationId: confirmation.id,
      tool: toolCall.tool,
      success: result.success,
      source: input.source,
      operatorId: currentOperatorId(input),
    },
  });

  return {
    success: result.success,
    runId,
    intent: result.intent,
    reply: result.reply,
    error: result.success ? null : result.reply,
    confirmation: null,
  };
}

export async function runCrmCommand(
  input: CrmCommandInput,
): Promise<CrmCommandResult> {
  const run = await createRun({
    source: input.source,
    senderPhone: input.senderPhone,
    senderRole: input.senderRole,
    commandText: input.messageText,
    status: "running",
    conversationId: input.conversationId,
  });
  const runId = run?.id ?? null;
  const conversationNumber = toConversationNumber(input.conversationId);

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: "message_received",
    message: `Messaggio ${input.source} ricevuto da ${input.senderName || input.senderTelegramId || input.senderPhone || "sconosciuto"}`,
    metadata: {
      source: input.source,
      senderPhone: input.senderPhone,
      senderTelegramId: input.senderTelegramId,
      senderName: input.senderName,
      senderRole: input.senderRole,
      operatorId: input.operatorId ?? null,
      operatorRole: input.operatorRole ?? null,
      conversationId: input.conversationId,
      messageText: input.messageText,
    },
  });

  const confirmationAction = parseConfirmationAction(input.messageText);
  if (confirmationAction) {
    return handleConfirmationAction(
      input,
      runId,
      conversationNumber,
      confirmationAction,
    );
  }

  const executedSteps: Array<{ tool: string; result: string }> = [];
  const replies: string[] = [];
  let finalTool = "";
  let finalIntent: Intent = "unknown";
  let allSuccess = true;
  let finalStatus: RunStatus = "completed";
  let finalRiskLevel: RiskLevel = "low";
  let awaitingConfirmation = false;
  let confirmationResult: CrmCommandResult["confirmation"] = null;

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    let toolCall;
    try {
      toolCall = step === 0
        ? await chooseTool(input.messageText, conversationNumber)
        : await chooseNextTool(input.messageText, executedSteps);
    } catch {
      toolCall = { tool: "reply", args: { message: "Non ho capito il comando." } };
    }

    await logWorkflowEvent({
      runId: runId ?? undefined,
      eventType: "intent_classified",
      message: `Tool scelto: ${toolCall.tool}`,
      metadata: {
        source: input.source,
        tool: toolCall.tool,
        args: toolCall.args,
        operatorId: input.operatorId ?? null,
      },
    });

    if (runId && step === 0) {
      await updateRun(runId, { intent: toolCall.tool });
    }

    if (toolCall.tool === "done") {
      const msg = (toolCall.args.message as string) || "";
      if (msg) replies.push(msg);
      finalTool = finalTool || "done";
      break;
    }

    const authorization = authorizeCrmTool({
      tool: toolCall.tool,
      senderRole: input.senderRole,
      operator: input.operator ?? null,
    });

    if (!authorization.allowed) {
      const reason = authorization.reason ?? "Non hai il permesso per eseguire questo comando.";
      replies.push(reason);
      allSuccess = false;
      finalStatus = "unauthorized";
      finalTool = toolCall.tool;
      await logWorkflowEvent({
        runId: runId ?? undefined,
        eventType: "unauthorized",
        message: reason,
        metadata: {
          source: input.source,
          tool: toolCall.tool,
          requiredScope: authorization.requiredScope,
          operatorId: input.operatorId ?? input.operator?.id ?? null,
          operatorRole: input.operatorRole ?? input.operator?.role ?? null,
        },
      });
      break;
    }

    const confirmationRequirement = requiresCrmToolConfirmation(toolCall.tool);
    if (confirmationRequirement.required) {
      const confirmation = await createCommandConfirmation({
        source: input.source,
        conversationId: input.conversationId,
        senderTelegramId: input.senderTelegramId,
        operatorId: currentOperatorId(input),
        operatorRole: currentOperatorRole(input),
        senderRole: input.senderRole,
        commandText: input.messageText,
        toolName: toolCall.tool,
        toolArgs: toolCall.args,
        riskLevel: confirmationRequirement.riskLevel,
        requestedRunId: runId,
      }).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[command-runner] failed to create confirmation:", errorMessage);
        return null;
      });

      if (!confirmation) {
        const reply = "Non posso eseguire questa modifica perché il registro conferme non è configurato. Esegui il setup Appwrite prima di usare comandi rischiosi.";
        replies.push(reply);
        allSuccess = false;
        finalStatus = "failed";
        finalTool = toolCall.tool;
        finalRiskLevel = confirmationRequirement.riskLevel;
        break;
      }

      const reply = buildConfirmationReply({
        tool: toolCall.tool,
        riskLevel: confirmation.riskLevel,
        code: confirmation.confirmationCode,
        expiresAt: confirmation.expiresAt,
      });

      replies.push(reply);
      finalTool = toolCall.tool;
      finalRiskLevel = confirmation.riskLevel;
      finalStatus = "waiting_for_data";
      awaitingConfirmation = true;
      confirmationResult = {
        code: confirmation.confirmationCode,
        tool: confirmation.toolName,
        riskLevel: confirmation.riskLevel,
      };

      await logWorkflowEvent({
        runId: runId ?? undefined,
        eventType: "permission_checked",
        message: "Conferma richiesta prima dell'esecuzione comando",
        metadata: {
          confirmationId: confirmation.id,
          confirmationCode: confirmation.confirmationCode,
          tool: toolCall.tool,
          riskLevel: confirmation.riskLevel,
          source: input.source,
          operatorId: currentOperatorId(input),
          operatorRole: currentOperatorRole(input),
        },
      });

      break;
    }

    const result = await executeTool(
      toolCall,
      input.messageText,
      runId,
      conversationNumber,
    );

    executedSteps.push({ tool: toolCall.tool, result: result.reply });
    if (result.reply) replies.push(result.reply);
    if (!result.success) allSuccess = false;
    finalTool = toolCall.tool;
    finalIntent = result.intent;
    finalRiskLevel = requiresCrmToolConfirmation(toolCall.tool).riskLevel;

    if (toolCall.tool === "reply" || !result.success) {
      if (!result.success) finalStatus = "failed";
      break;
    }
  }

  const finalReply = replies.filter(Boolean).join("\n\n");

  if (runId) {
    await updateRun(runId, {
      status: awaitingConfirmation
        ? "waiting_for_data"
        : allSuccess
          ? finalStatus
          : finalStatus === "unauthorized"
            ? "unauthorized"
            : "failed",
      resultSummary: finalReply.slice(0, 500),
      riskLevel: finalRiskLevel,
      currentStep: awaitingConfirmation ? "waiting_for_confirmation" : null,
      error: allSuccess ? null : finalReply.slice(0, 500),
    });
  }

  await logWorkflowEvent({
    runId: runId ?? undefined,
    eventType: awaitingConfirmation ? "permission_checked" : (allSuccess ? "command_executed" : "error"),
    message: finalReply.slice(0, 500),
    metadata: {
      source: input.source,
      tool: finalTool,
      success: allSuccess,
      awaitingConfirmation,
      operatorId: currentOperatorId(input),
    },
  });

  return {
    success: allSuccess,
    runId,
    intent: finalIntent,
    reply: finalReply || "Comando ricevuto, ma non ho generato una risposta.",
    error: null,
    confirmation: confirmationResult,
  };
}
