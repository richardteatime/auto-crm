import type {
  TelegramCallbackQuery,
  NormalizedTelegramMessage,
  TelegramMessage,
  TelegramUpdate,
  TelegramUser,
} from "./types";

function buildSenderName(user: TelegramUser | undefined): string | null {
  if (!user) return null;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username || String(user.id);
}

function extractMessage(update: TelegramUpdate): TelegramMessage | null {
  return update.message ?? update.edited_message ?? null;
}

export function normalizeTelegramUpdate(
  update: TelegramUpdate,
): NormalizedTelegramMessage | null {
  const message = extractMessage(update);
  if (!message) return null;

  const text = message.text ?? message.caption ?? "";
  const messageType = message.text
    ? "text"
    : message.caption
      ? "caption"
      : "unsupported";

  return {
    updateId: String(update.update_id),
    messageId: String(message.message_id),
    chatId: String(message.chat.id),
    senderTelegramId: message.from ? String(message.from.id) : null,
    senderName: buildSenderName(message.from),
    username: message.from?.username ?? null,
    direction: "inbound",
    messageText: text,
    messageType,
    rawPayload: JSON.stringify(update),
  };
}

export function normalizeTelegramCallbackQuery(
  update: TelegramUpdate,
  callbackQuery: TelegramCallbackQuery,
): NormalizedTelegramMessage | null {
  if (!callbackQuery.message) return null;

  return {
    updateId: String(update.update_id),
    messageId: `callback:${callbackQuery.id}`,
    chatId: String(callbackQuery.message.chat.id),
    senderTelegramId: String(callbackQuery.from.id),
    senderName: buildSenderName(callbackQuery.from),
    username: callbackQuery.from.username ?? null,
    direction: "inbound",
    messageText: callbackQuery.data ?? "",
    messageType: "callback",
    rawPayload: JSON.stringify(update),
  };
}
