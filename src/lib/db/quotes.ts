import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Quote {
  id: string;
  dealId: string;
  number: string;
  title: string;
  items: string; // JSON string
  notes: string | null;
  status: "bozza" | "inviato" | "accettato" | "rifiutato";
  vatRate: number;
  validUntil: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIsoDate(
  d: Date | string | number | null | undefined,
): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "number")
    return new Date(d < 1e12 ? d * 1000 : d).toISOString();
  return new Date(d).toISOString();
}

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as T;
}

/**
 * Auto-generate a quote number in the format: Q-YYYYMMDD-NNN
 * Uses the latest quote for today to compute the sequential suffix.
 */
async function generateQuoteNumber(): Promise<string> {
  const today = new Date();
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("");

  const prefix = `Q-${dateStr}-`;

  // Find quotes with today's prefix to determine the next sequence number
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.quotes, [
    Query.startsWith("number", prefix),
    Query.orderDesc("number"),
    Query.limit(1),
  ]);

  let seq = 1;
  if (res.documents.length > 0) {
    const lastNumber = res.documents[0].number as string;
    const lastSeq = parseInt(lastNumber.split("-").pop() ?? "0", 10);
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// listQuotes
// ---------------------------------------------------------------------------

export async function listQuotes(filters?: {
  dealId?: string;
  status?: string;
}): Promise<Quote[]> {
  const queries: string[] = [Query.orderDesc("$createdAt"), Query.limit(500)];

  if (filters?.dealId) {
    queries.push(Query.equal("dealId", filters.dealId));
  }
  if (filters?.status) {
    queries.push(Query.equal("status", filters.status));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.quotes, queries);
  return res.documents.map((d) => fromDoc<Quote>(d));
}

// ---------------------------------------------------------------------------
// getQuote
// ---------------------------------------------------------------------------

export async function getQuote(id: string): Promise<Quote | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.quotes, id);
    return fromDoc<Quote>(doc);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// createQuote
// ---------------------------------------------------------------------------

export async function createQuote(data: {
  dealId: string;
  title: string;
  items?: string;
  notes?: string | null;
  vatRate?: number;
  validUntil?: Date | string | number | null;
}): Promise<Quote> {
  const number = await generateQuoteNumber();

  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.quotes,
    ID.unique(),
    {
      dealId: data.dealId,
      number,
      title: data.title,
      items: data.items ?? "[]",
      notes: data.notes ?? null,
      status: "bozza",
      vatRate: data.vatRate ?? 22,
      validUntil: toIsoDate(data.validUntil),
    },
  );
  return fromDoc<Quote>(doc);
}

// ---------------------------------------------------------------------------
// updateQuote
// ---------------------------------------------------------------------------

export async function updateQuote(
  id: string,
  data: Partial<{
    title: string;
    items: string;
    notes: string | null;
    status: string;
    vatRate: number;
    validUntil: Date | string | number | null;
  }>,
): Promise<Quote> {
  const payload: Record<string, unknown> = { ...data };

  if (data.validUntil !== undefined) {
    payload.validUntil = toIsoDate(data.validUntil);
  }

  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.quotes,
    id,
    payload,
  );
  return fromDoc<Quote>(doc);
}

// ---------------------------------------------------------------------------
// deleteQuote
// ---------------------------------------------------------------------------

export async function deleteQuote(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.quotes, id);
}
