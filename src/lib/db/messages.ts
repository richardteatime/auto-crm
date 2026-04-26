import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, Query, type Models } from "node-appwrite";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as T;
}

// ---------------------------------------------------------------------------
// listMessages
// ---------------------------------------------------------------------------

export async function listMessages(sinceId?: string): Promise<Message[]> {
  const queries: string[] = [Query.orderAsc("$createdAt"), Query.limit(500)];

  if (sinceId) {
    // Cursor-based pagination: fetch documents after the given ID
    // We use cursorAfter for forward pagination
    queries.push(Query.cursorAfter(sinceId));
  }

  const res = await databases.listDocuments(
    DB_ID,
    COLLECTIONS.messages,
    queries,
  );
  return res.documents.map((d) => fromDoc<Message>(d));
}

// ---------------------------------------------------------------------------
// createMessage
// ---------------------------------------------------------------------------

export async function createMessage(data: {
  author: string;
  content: string;
}): Promise<Message> {
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.messages,
    ID.unique(),
    {
      author: data.author,
      content: data.content,
    },
  );
  return fromDoc<Message>(doc);
}
