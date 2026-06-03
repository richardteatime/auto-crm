import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { NormalizedTelegramMessage } from "@/lib/telegram/types";

export interface TelegramMessageRecord {
  id: string;
  updateId: string;
  messageId: string;
  chatId: string;
  senderTelegramId: string | null;
  senderName: string | null;
  username: string | null;
  direction: "inbound";
  messageText: string;
  messageType: string;
  rawPayload: string;
  processed: boolean;
  runId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function fromDoc(doc: Models.Document): TelegramMessageRecord {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    updateId: rest.updateId as string,
    messageId: rest.messageId as string,
    chatId: rest.chatId as string,
    senderTelegramId: (rest.senderTelegramId as string | null) ?? null,
    senderName: (rest.senderName as string | null) ?? null,
    username: (rest.username as string | null) ?? null,
    direction: rest.direction as "inbound",
    messageText: rest.messageText as string,
    messageType: rest.messageType as string,
    rawPayload: rest.rawPayload as string,
    processed: Boolean(rest.processed),
    runId: (rest.runId as string | null) ?? null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

export async function getTelegramMessageByUpdateId(
  updateId: string,
): Promise<TelegramMessageRecord | null> {
  const res = await databases.listDocuments(
    DB_ID,
    COLLECTIONS.telegramMessages,
    [Query.equal("updateId", updateId), Query.limit(1)],
  );
  const [doc] = res.documents;
  return doc ? fromDoc(doc) : null;
}

export async function listTelegramMessages(filters?: {
  chatId?: string;
  limit?: number;
}): Promise<TelegramMessageRecord[]> {
  const queries: string[] = [
    Query.limit(filters?.limit ?? 20),
    Query.orderDesc("$createdAt"),
  ];
  if (filters?.chatId) {
    queries.push(Query.equal("chatId", filters.chatId));
  }

  const res = await databases.listDocuments(
    DB_ID,
    COLLECTIONS.telegramMessages,
    queries,
  );
  return res.documents.map((doc) => fromDoc(doc));
}

export async function createTelegramMessage(
  data: NormalizedTelegramMessage,
): Promise<TelegramMessageRecord> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.telegramMessages,
    ID.unique(),
    {
      updateId: data.updateId,
      messageId: data.messageId,
      chatId: data.chatId,
      senderTelegramId: data.senderTelegramId,
      senderName: data.senderName,
      username: data.username,
      direction: data.direction,
      messageText: data.messageText,
      messageType: data.messageType,
      rawPayload: data.rawPayload,
      processed: false,
      runId: null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc(doc);
}

export async function markTelegramMessageProcessed(
  id: string,
  runId: string | null,
): Promise<void> {
  await databases.updateDocument(DB_ID, COLLECTIONS.telegramMessages, id, {
    processed: true,
    runId,
    updatedAt: new Date().toISOString(),
  });
}
