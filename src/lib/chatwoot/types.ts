// ---------------------------------------------------------------------------
// Chatwoot webhook payload types
// ---------------------------------------------------------------------------

export interface ChatwootSender {
  id: number;
  name: string;
  email?: string | null;
  phone_number?: string | null;
  thumbnail?: string | null;
  custom_attributes?: Record<string, unknown>;
  additional_attributes?: Record<string, unknown>;
}

export interface ChatwootConversation {
  id: number;
  inbox_id: number;
  status: string;
  contact_inbox?: {
    source_id: string;
  };
}

export interface ChatwootMessagePayload {
  event: string;
  id: number;
  content: string;
  message_type: "incoming" | "outgoing";
  content_type: string;
  content_attributes?: Record<string, unknown>;
  created_at: string;
  conversation: ChatwootConversation;
  sender: ChatwootSender;
}

export interface NormalizedChatwootMessage {
  chatwootMessageId: number;
  conversationId: number;
  chatwootContactId: number;
  senderPhone: string | null;
  senderTelegramId: string | null;
  senderName: string | null;
  direction: "inbound" | "outbound";
  messageText: string;
  messageType: string;
  rawPayload: string;
}

export interface ChatwootConfig {
  url: string;
  accountId: string;
  apiAccessToken: string;
  webhookSecret: string | null;
}
