import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { NormalizedChatwootMessage } from "@/lib/chatwoot/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fromDoc(doc: Models.Document) {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listChatwootMessages(filters?: {
  conversationId?: number;
  senderPhone?: string;
  processed?: boolean;
  limit?: number;
}): Promise<unknown[]> {
  const queries: string[] = [
    Query.limit(filters?.limit ?? 200),
    Query.orderDesc("$createdAt"),
  ];

  if (filters?.conversationId !== undefined) {
    queries.push(Query.equal("conversationId", String(filters.conversationId)));
  }
  if (filters?.senderPhone) {
    queries.push(Query.equal("senderPhone", filters.senderPhone));
  }
  if (filters?.processed !== undefined) {
    queries.push(Query.equal("processed", filters.processed));
  }

  const res = await databases.listDocuments(
    DB_ID,
    COLLECTIONS.chatwootMessages,
    queries,
  );
  return res.documents.map((d) => fromDoc(d));
}

export async function createChatwootMessage(
  data: NormalizedChatwootMessage,
): Promise<unknown> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.chatwootMessages,
    ID.unique(),
    {
      chatwootMessageId: String(data.chatwootMessageId),
      conversationId: String(data.conversationId),
      chatwootContactId: String(data.chatwootContactId),
      senderPhone: data.senderPhone ?? null,
      senderName: data.senderName ?? null,
      direction: data.direction,
      messageText: data.messageText,
      messageType: data.messageType,
      rawPayload: data.rawPayload,
      processed: false,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc(doc);
}

export async function markChatwootMessageProcessed(id: string): Promise<void> {
  await databases.updateDocument(DB_ID, COLLECTIONS.chatwootMessages, id, {
    processed: true,
    updatedAt: new Date().toISOString(),
  });
}
