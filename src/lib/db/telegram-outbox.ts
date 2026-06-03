import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";

export type TelegramOutboxStatus = "pending" | "sent" | "failed";

export interface TelegramOutboxRecord {
  id: string;
  chatId: string;
  messageText: string;
  status: TelegramOutboxStatus;
  telegramMessageId: string | null;
  runId: string | null;
  error: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function fromDoc(doc: Models.Document): TelegramOutboxRecord {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    chatId: rest.chatId as string,
    messageText: rest.messageText as string,
    status: rest.status as TelegramOutboxStatus,
    telegramMessageId: (rest.telegramMessageId as string | null) ?? null,
    runId: (rest.runId as string | null) ?? null,
    error: (rest.error as string | null) ?? null,
    sentAt: rest.sentAt ? new Date(rest.sentAt as string) : null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

export async function createTelegramOutboxMessage(data: {
  chatId: string;
  messageText: string;
  runId?: string | null;
}): Promise<TelegramOutboxRecord> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.telegramOutbox,
    ID.unique(),
    {
      chatId: data.chatId,
      messageText: data.messageText,
      status: "pending",
      telegramMessageId: null,
      runId: data.runId ?? null,
      error: null,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc(doc);
}

export async function markTelegramOutboxSent(
  id: string,
  telegramMessageId: string | null,
): Promise<void> {
  await databases.updateDocument(DB_ID, COLLECTIONS.telegramOutbox, id, {
    status: "sent",
    telegramMessageId,
    error: null,
    sentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function markTelegramOutboxFailed(
  id: string,
  error: string,
): Promise<void> {
  await databases.updateDocument(DB_ID, COLLECTIONS.telegramOutbox, id, {
    status: "failed",
    error,
    updatedAt: new Date().toISOString(),
  });
}
