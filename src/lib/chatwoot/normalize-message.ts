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

function extractTelegramId(
  sender: ChatwootMessagePayload["sender"],
  conversation?: ChatwootMessagePayload["conversation"],
): string | null {
  // 1. Try sender.additional_attributes.telegram_id
  const additional = sender.additional_attributes;
  if (additional) {
    const tid = additional.telegram_id as string | number | undefined;
    if (tid) return String(tid);

    // 2. Try source_id (Chatwoot sometimes stores it here)
    const sid = additional.source_id as string | number | undefined;
    if (sid) return String(sid);
  }

  // 3. Try sender.custom_attributes.telegram_id
  const custom = sender.custom_attributes;
  if (custom) {
    const ctid = custom.telegram_id as string | number | undefined;
    if (ctid) return String(ctid);
  }

  // 4. Try conversation.contact_inbox.source_id
  if (conversation?.contact_inbox?.source_id) {
    return String(conversation.contact_inbox.source_id);
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
    senderTelegramId: extractTelegramId(payload.sender, payload.conversation),
    senderName: payload.sender.name || null,
    direction,
    messageText: payload.content || "",
    messageType: payload.content_type || "text",
    rawPayload: JSON.stringify(payload),
  };
}
