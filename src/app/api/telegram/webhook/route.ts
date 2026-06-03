import { NextRequest, NextResponse } from "next/server";
import {
  normalizeTelegramCallbackQuery,
  normalizeTelegramUpdate,
} from "@/lib/telegram/normalize-update";
import {
  answerTelegramCallbackQuery,
  clearTelegramInlineKeyboard,
  sendTelegramMessage,
} from "@/lib/telegram/client";
import type {
  TelegramInlineKeyboardMarkup,
  TelegramUpdate,
} from "@/lib/telegram/types";
import {
  createTelegramMessage,
  getTelegramMessageByUpdateId,
  markTelegramMessageProcessed,
} from "@/lib/db/telegram-messages";
import {
  createTelegramOutboxMessage,
  markTelegramOutboxFailed,
  markTelegramOutboxSent,
} from "@/lib/db/telegram-outbox";
import { checkInternalCommandPermission } from "@/lib/orchestrator/permissions";
import { runCrmCommand } from "@/lib/orchestrator/command-runner";
import { logWorkflowEvent } from "@/lib/orchestrator/logger";

function verifyTelegramSecret(request: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!expected) return false;
  return request.headers.get("x-telegram-bot-api-secret-token") === expected;
}

function buildConfirmationKeyboard(
  code: string,
): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Conferma", callback_data: `crm_confirm:${code}` },
        { text: "❌ Annulla", callback_data: `crm_cancel:${code}` },
      ],
    ],
  };
}

function parseConfirmationCallback(data: string | undefined): {
  messageText: string;
  code: string;
  action: "confirm" | "cancel";
} | null {
  const match = (data ?? "").match(/^crm_(confirm|cancel):([a-z0-9]{4,12})$/i);
  if (!match) return null;

  const action = match[1].toLowerCase() === "confirm" ? "confirm" : "cancel";
  const code = match[2].toUpperCase();
  return {
    action,
    code,
    messageText: action === "confirm" ? `CONFERMA ${code}` : `ANNULLA ${code}`,
  };
}

async function sendTrackedTelegramReply(
  chatId: string,
  messageText: string,
  runId?: string | null,
  replyMarkup?: TelegramInlineKeyboardMarkup,
): Promise<void> {
  const outbox = await createTelegramOutboxMessage({
    chatId,
    messageText,
    runId,
  });

  try {
    const sentMessages = await sendTelegramMessage(chatId, messageText, {
      replyMarkup,
    });
    const firstMessageId = sentMessages[0]?.message_id;
    await markTelegramOutboxSent(
      outbox.id,
      firstMessageId !== undefined ? String(firstMessageId) : null,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markTelegramOutboxFailed(outbox.id, errorMessage);
    throw error;
  }
}

async function handleTelegramCallback(update: TelegramUpdate) {
  const callback = update.callback_query;
  if (!callback) {
    return NextResponse.json({ ignored: true, reason: "missing_callback_query" });
  }

  const normalized = normalizeTelegramCallbackQuery(update, callback);
  if (!normalized) {
    await answerTelegramCallbackQuery(callback.id, "Callback non gestibile").catch(() => undefined);
    return NextResponse.json({ ignored: true, reason: "callback_without_message" });
  }

  const existing = await getTelegramMessageByUpdateId(normalized.updateId);
  if (existing) {
    await answerTelegramCallbackQuery(callback.id, "Già ricevuto").catch(() => undefined);
    return NextResponse.json({
      duplicate: true,
      updateId: normalized.updateId,
      processed: existing.processed,
      runId: existing.runId,
    });
  }

  const parsed = parseConfirmationCallback(callback.data);
  if (!parsed) {
    await answerTelegramCallbackQuery(callback.id, "Azione non riconosciuta").catch(() => undefined);
    return NextResponse.json({ ignored: true, reason: "unsupported_callback" });
  }

  const saved = await createTelegramMessage({
    ...normalized,
    messageText: parsed.messageText,
  });

  await answerTelegramCallbackQuery(
    callback.id,
    parsed.action === "confirm" ? "Conferma ricevuta" : "Annullamento ricevuto",
  ).catch(() => undefined);

  const permission = await checkInternalCommandPermission({
    phone: null,
    telegramId: normalized.senderTelegramId,
    requiredScope: "crm:command",
  });

  if (!permission.allowed) {
    const reply = permission.reason ?? "Questo bot al momento è riservato agli operatori CRM SarconX.";
    await sendTrackedTelegramReply(normalized.chatId, reply);
    await markTelegramMessageProcessed(saved.id, null);
    return NextResponse.json({
      blocked: true,
      reason: permission.reason,
      role: permission.role,
      operatorId: permission.operator?.id ?? null,
    });
  }

  try {
    const result = await runCrmCommand({
      source: "telegram",
      senderPhone: null,
      senderTelegramId: normalized.senderTelegramId,
      senderName: normalized.senderName,
      senderRole: permission.role,
      operator: permission.operator,
      operatorId: permission.operator?.id ?? null,
      operatorRole: permission.operator?.role ?? null,
      conversationId: normalized.chatId,
      messageText: parsed.messageText,
    });

    if (callback.message?.message_id) {
      await clearTelegramInlineKeyboard(
        normalized.chatId,
        callback.message.message_id,
      ).catch(() => undefined);
    }

    await sendTrackedTelegramReply(normalized.chatId, result.reply, result.runId);
    await markTelegramMessageProcessed(saved.id, result.runId);

    await logWorkflowEvent({
      runId: result.runId ?? undefined,
      eventType: "reply_sent",
      message: "Risposta callback Telegram inviata",
      metadata: {
        source: "telegram",
        chatId: normalized.chatId,
        updateId: normalized.updateId,
        callbackAction: parsed.action,
        operatorId: permission.operator?.id ?? null,
      },
    });

    return NextResponse.json({
      success: result.success,
      updateId: normalized.updateId,
      chatId: normalized.chatId,
      role: permission.role,
      operatorId: permission.operator?.id ?? null,
      runId: result.runId,
      callbackAction: parsed.action,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logWorkflowEvent({
      eventType: "error",
      message: `Telegram callback error: ${errorMessage}`,
      metadata: {
        source: "telegram",
        chatId: normalized.chatId,
        updateId: normalized.updateId,
        error: errorMessage,
      },
    });

    await markTelegramMessageProcessed(saved.id, null);

    return NextResponse.json(
      { success: false, updateId: normalized.updateId, error: errorMessage },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!verifyTelegramSecret(request)) {
    return NextResponse.json(
      { error: "Telegram webhook secret non valido o non configurato" },
      { status: 401 },
    );
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (update.callback_query) {
    return handleTelegramCallback(update);
  }

  const normalized = normalizeTelegramUpdate(update);
  if (!normalized) {
    return NextResponse.json({ ignored: true, reason: "unsupported_update" });
  }

  const existing = await getTelegramMessageByUpdateId(normalized.updateId);
  if (existing) {
    return NextResponse.json({
      duplicate: true,
      updateId: normalized.updateId,
      processed: existing.processed,
      runId: existing.runId,
    });
  }

  const saved = await createTelegramMessage(normalized);

  if (!normalized.messageText.trim() || normalized.messageType === "unsupported") {
    await markTelegramMessageProcessed(saved.id, null);
    return NextResponse.json({ ignored: true, reason: "empty_or_unsupported_message" });
  }

  const permission = await checkInternalCommandPermission({
    phone: null,
    telegramId: normalized.senderTelegramId,
    requiredScope: "crm:command",
  });

  if (!permission.allowed) {
    await logWorkflowEvent({
      eventType: "unauthorized",
      message: `Bloccato messaggio Telegram da ${normalized.senderTelegramId || "mittente sconosciuto"} (${permission.role})`,
      metadata: {
        source: "telegram",
        chatId: normalized.chatId,
        senderTelegramId: normalized.senderTelegramId,
        senderName: normalized.senderName,
        username: normalized.username,
        role: permission.role,
        operatorId: permission.operator?.id ?? null,
        operatorRole: permission.operator?.role ?? null,
        messageText: normalized.messageText,
      },
    });

    const reply = permission.reason ?? "Questo bot al momento è riservato agli operatori CRM SarconX.";
    await sendTrackedTelegramReply(normalized.chatId, reply);
    await markTelegramMessageProcessed(saved.id, null);

    return NextResponse.json({
      blocked: true,
      reason: permission.reason,
      role: permission.role,
      operatorId: permission.operator?.id ?? null,
    });
  }

  try {
    const result = await runCrmCommand({
      source: "telegram",
      senderPhone: null,
      senderTelegramId: normalized.senderTelegramId,
      senderName: normalized.senderName,
      senderRole: permission.role,
      operator: permission.operator,
      operatorId: permission.operator?.id ?? null,
      operatorRole: permission.operator?.role ?? null,
      conversationId: normalized.chatId,
      messageText: normalized.messageText,
    });

    await sendTrackedTelegramReply(
      normalized.chatId,
      result.reply,
      result.runId,
      result.confirmation
        ? buildConfirmationKeyboard(result.confirmation.code)
        : undefined,
    );
    await markTelegramMessageProcessed(saved.id, result.runId);

    await logWorkflowEvent({
      runId: result.runId ?? undefined,
      eventType: "reply_sent",
      message: "Risposta inviata su Telegram",
      metadata: {
        source: "telegram",
        chatId: normalized.chatId,
        updateId: normalized.updateId,
        operatorId: permission.operator?.id ?? null,
      },
    });

    return NextResponse.json({
      success: result.success,
      updateId: normalized.updateId,
      chatId: normalized.chatId,
      role: permission.role,
      operatorId: permission.operator?.id ?? null,
      runId: result.runId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logWorkflowEvent({
      eventType: "error",
      message: `Telegram command error: ${errorMessage}`,
      metadata: {
        source: "telegram",
        chatId: normalized.chatId,
        updateId: normalized.updateId,
        error: errorMessage,
      },
    });

    await markTelegramMessageProcessed(saved.id, null);

    return NextResponse.json(
      { success: false, updateId: normalized.updateId, error: errorMessage },
      { status: 500 },
    );
  }
}
