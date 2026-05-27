import type {
  ChatwootMessagePayload,
  NormalizedChatwootMessage,
} from "./types";

function extractPhone(sender: ChatwootMessagePayload["sender"]): string | null {
  // Try phone_number directly
  if (sender.phone_number) {
    return sender.phone_number;
  }
  // Try additional_attributes.whatsapp or phone_number
  const additional = sender.additional_attributes;
  if (additional) {
    const fromWhatsapp = additional.whatsapp as string | undefined;
    const fromPhone = additional.phone_number as string | undefined;
    if (fromWhatsapp) return fromWhatsapp;
    if (fromPhone) return fromPhone;
  }
  // Try custom_attributes
  const custom = sender.custom_attributes;
  if (custom) {
    const customPhone = custom.phone as string | undefined;
    if (customPhone) return customPhone;
  }
  return null;
}

function extractTelegramId(sender: ChatwootMessagePayload["sender"]): string | null {
  const additional = sender.additional_attributes;
  if (additional) {
    const tid = additional.telegram_id as string | number | undefined;
    if (tid) return String(tid);
  }
  return null;
}

export function normalizeChatwootMessage(
  payload: ChatwootMessagePayload,
): NormalizedChatwootMessage {
  const direction = payload.message_type === "outgoing" ? "outbound" : "inbound";

  return {
    chatwootMessageId: payload.id,
    conversationId: payload.conversation.id,
    chatwootContactId: payload.sender.id,
    senderPhone: extractPhone(payload.sender),
    senderTelegramId: extractTelegramId(payload.sender),
    senderName: payload.sender.name || null,
    direction,
    messageText: payload.content || "",
    messageType: payload.content_type || "text",
    rawPayload: JSON.stringify(payload),
  };
}
