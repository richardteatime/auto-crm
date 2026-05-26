import type { ChatwootConfig } from "./types";

function getConfig(): ChatwootConfig {
  return {
    url: process.env.CHATWOOT_URL || "",
    accountId: process.env.CHATWOOT_ACCOUNT_ID || "",
    apiAccessToken: process.env.CHATWOOT_API_ACCESS_TOKEN || "",
    webhookSecret: process.env.CHATWOOT_WEBHOOK_SECRET || null,
  };
}

function buildHeaders(config: ChatwootConfig) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Api-Access-Token": config.apiAccessToken,
  };
}

function isConfigured(config: ChatwootConfig): boolean {
  return !!(config.url && config.accountId && config.apiAccessToken);
}

export async function sendChatwootMessage(
  conversationId: number | string,
  message: string,
  messageType: "outgoing" | "private" = "outgoing",
): Promise<{ id: number } | null> {
  const config = getConfig();
  if (!isConfigured(config)) {
    console.error("[chatwoot] client non configurato");
    return null;
  }

  try {
    const res = await fetch(
      `${config.url}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: buildHeaders(config),
        body: JSON.stringify({
          content: message,
          message_type: messageType,
          private: messageType === "private",
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`[chatwoot] sendMessage failed ${res.status}:`, text.slice(0, 500));
      return null;
    }

    const data = await res.json();
    return { id: data.id };
  } catch (err) {
    console.error("[chatwoot] sendMessage error:", err);
    return null;
  }
}

export async function sendPrivateNote(
  conversationId: number | string,
  message: string,
): Promise<{ id: number } | null> {
  return sendChatwootMessage(conversationId, message, "private");
}

export async function getConversation(
  conversationId: number | string,
): Promise<unknown | null> {
  const config = getConfig();
  if (!isConfigured(config)) return null;

  try {
    const res = await fetch(
      `${config.url}/api/v1/accounts/${config.accountId}/conversations/${conversationId}`,
      {
        headers: buildHeaders(config),
      },
    );

    if (!res.ok) {
      console.error(`[chatwoot] getConversation failed ${res.status}`);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error("[chatwoot] getConversation error:", err);
    return null;
  }
}

export async function getContact(
  contactId: number | string,
): Promise<unknown | null> {
  const config = getConfig();
  if (!isConfigured(config)) return null;

  try {
    const res = await fetch(
      `${config.url}/api/v1/accounts/${config.accountId}/contacts/${contactId}`,
      {
        headers: buildHeaders(config),
      },
    );

    if (!res.ok) {
      console.error(`[chatwoot] getContact failed ${res.status}`);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error("[chatwoot] getContact error:", err);
    return null;
  }
}
