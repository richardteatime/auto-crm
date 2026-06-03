import type {
  TelegramApiMessage,
  TelegramInlineKeyboardMarkup,
} from "./types";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const TELEGRAM_MAX_TEXT_LENGTH = 4096;
const SAFE_CHUNK_LENGTH = 3900;

function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function splitTelegramText(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_TEXT_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, SAFE_CHUNK_LENGTH));
    remaining = remaining.slice(SAFE_CHUNK_LENGTH);
  }
  return chunks;
}

export function isTelegramConfigured(): boolean {
  return Boolean(getTelegramBotToken());
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: {
    replyMarkup?: TelegramInlineKeyboardMarkup;
  },
): Promise<TelegramApiMessage[]> {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN non configurato");
  }

  const sent: TelegramApiMessage[] = [];
  const chunks = splitTelegramText(text);
  for (const [index, chunk] of chunks.entries()) {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
        ...(options?.replyMarkup && index === chunks.length - 1
          ? { reply_markup: options.replyMarkup }
          : {}),
      }),
    });

    const data = await res.json().catch(() => null) as {
      ok?: boolean;
      result?: TelegramApiMessage;
      description?: string;
    } | null;

    if (!res.ok || !data?.ok || !data.result) {
      throw new Error(
        data?.description || `Telegram sendMessage failed with status ${res.status}`,
      );
    }

    sent.push(data.result);
  }

  return sent;
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN non configurato");
  }

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  });

  const data = await res.json().catch(() => null) as {
    ok?: boolean;
    description?: string;
  } | null;

  if (!res.ok || !data?.ok) {
    throw new Error(
      data?.description || `answerCallbackQuery failed with status ${res.status}`,
    );
  }
}

export async function clearTelegramInlineKeyboard(
  chatId: string | number,
  messageId: string | number,
): Promise<void> {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN non configurato");
  }

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    }),
  });

  const data = await res.json().catch(() => null) as {
    ok?: boolean;
    description?: string;
  } | null;

  if (!res.ok || !data?.ok) {
    throw new Error(
      data?.description || `editMessageReplyMarkup failed with status ${res.status}`,
    );
  }
}
