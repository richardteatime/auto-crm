import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Opportunity } from "@/types";

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as T;
}

export async function listOpportunities(filters?: {
  contactId?: string;
  status?: string;
}): Promise<Opportunity[]> {
  const queries: string[] = [Query.orderDesc("$createdAt"), Query.limit(500)];
  if (filters?.contactId) queries.push(Query.equal("contactId", filters.contactId));
  if (filters?.status) queries.push(Query.equal("status", filters.status));
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.opportunities, queries);
  return res.documents.map((d) => fromDoc<Opportunity>(d));
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.opportunities, id);
    return fromDoc<Opportunity>(doc);
  } catch {
    return null;
  }
}

export async function createOpportunity(data: {
  contactId: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  attachments?: string | null;
  value?: number | null;
}): Promise<Opportunity> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.opportunities,
    ID.unique(),
    {
      contactId: data.contactId,
      title: data.title,
      description: data.description ?? null,
      notes: data.notes ?? null,
      attachments: data.attachments ?? null,
      value: data.value ?? null,
      status: "aperta",
      dealId: null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc<Opportunity>(doc);
}

export async function updateOpportunity(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    notes: string | null;
    attachments: string | null;
    value: number | null;
    status: string;
    dealId: string | null;
  }>,
): Promise<Opportunity> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.opportunities,
    id,
    payload,
  );
  return fromDoc<Opportunity>(doc);
}

export async function deleteOpportunity(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.opportunities, id);
}
