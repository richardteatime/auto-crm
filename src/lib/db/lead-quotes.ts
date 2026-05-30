import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type {
  LeadQuote,
  LeadQuoteStatus,
  LeadQuoteItem,
  LeadCategory,
} from "@/lib/leads/types";

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, createdAt, updatedAt, ...rest } = doc;
  void createdAt;
  void updatedAt;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as T;
}

export async function listLeadQuotes(leadId: string): Promise<LeadQuote[]> {
  try {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.leadQuotes, [
      Query.equal("leadId", leadId),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);
    return res.documents.map((d) => fromDoc<LeadQuote>(d));
  } catch {
    return [];
  }
}

export async function getLeadQuote(id: string): Promise<LeadQuote | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.leadQuotes, id);
    return fromDoc<LeadQuote>(doc);
  } catch {
    return null;
  }
}

export async function createLeadQuote(data: {
  leadId: string;
  category: LeadCategory;
  amountSuggested: number;
  items: LeadQuoteItem[];
  summary?: string | null;
  generatedText?: string | null;
  status?: LeadQuoteStatus;
}): Promise<LeadQuote> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.leadQuotes,
    ID.unique(),
    {
      leadId: data.leadId,
      status: data.status ?? "draft",
      category: data.category,
      amountSuggested: data.amountSuggested,
      items: JSON.stringify(data.items),
      summary: data.summary ?? null,
      generatedText: data.generatedText ?? null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc<LeadQuote>(doc);
}

export async function updateLeadQuote(
  id: string,
  data: Partial<{ status: LeadQuoteStatus; summary: string | null }>,
): Promise<LeadQuote> {
  const payload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (data.status !== undefined) payload.status = data.status;
  if (data.summary !== undefined) payload.summary = data.summary;
  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.leadQuotes,
    id,
    payload,
  );
  return fromDoc<LeadQuote>(doc);
}
