import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Revenue } from "@/types";

function parseCollectedBy(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
      return [value];
    } catch {
      return [value];
    }
  }
  return [];
}

function serializeCollectedBy(value: string[] | undefined | null): string | null {
  if (!value || value.length === 0) return null;
  return JSON.stringify(value);
}

function fromDoc(doc: Models.Document): Revenue {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    description: rest.description ?? "",
    amount: rest.amount ?? 0,
    date: rest.date ? new Date(rest.date) : new Date(),
    isRecurring: rest.isRecurring ?? false,
    recurringMonths: rest.recurringMonths ?? null,
    startDate: rest.startDate ? new Date(rest.startDate) : null,
    collectedBy: parseCollectedBy(rest.collectedBy),
    isExternal: rest.isExternal ?? false,
    dealId: rest.dealId ?? null,
    opportunityId: rest.opportunityId ?? null,
    deleteReason: rest.deleteReason ?? null,
    deletedAt: rest.deletedAt ? new Date(rest.deletedAt) : null,
  };
}

function toIso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  return new Date(d).toISOString();
}

export async function listRevenues(includeDeleted = false): Promise<Revenue[]> {
  const queries: string[] = [Query.limit(500), Query.orderDesc("$createdAt")];
  if (!includeDeleted) {
    queries.push(Query.isNull("deletedAt"));
  }
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.revenues, queries);
  return res.documents.map((d) => fromDoc(d));
}

export async function getRevenue(id: string): Promise<Revenue | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.revenues, id);
    return fromDoc(doc);
  } catch {
    return null;
  }
}

export async function createRevenue(data: {
  description: string;
  amount: number;
  date: Date | string;
  isRecurring?: boolean;
  recurringMonths?: number | null;
  startDate?: Date | string | null;
  collectedBy?: string[] | null;
  isExternal?: boolean;
  dealId?: string | null;
  opportunityId?: string | null;
}): Promise<Revenue> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.revenues, ID.unique(), {
    description: data.description,
    amount: data.amount,
    date: toIso(data.date) ?? now,
    isRecurring: data.isRecurring ?? false,
    recurringMonths: data.recurringMonths ?? null,
    startDate: toIso(data.startDate) ?? null,
    collectedBy: serializeCollectedBy(data.collectedBy),
    isExternal: data.isExternal ?? false,
    dealId: data.dealId ?? null,
    opportunityId: data.opportunityId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return fromDoc(doc);
}

export async function updateRevenue(
  id: string,
  data: Partial<{
    description: string;
    amount: number;
    date: Date | string;
    isRecurring: boolean;
    recurringMonths: number | null;
    startDate: Date | string | null;
    collectedBy: string[] | null;
    isExternal: boolean;
    dealId: string | null;
    opportunityId: string | null;
  }>,
): Promise<Revenue> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  if (data.date !== undefined) payload.date = toIso(data.date) ?? null;
  if (data.startDate !== undefined) payload.startDate = toIso(data.startDate) ?? null;
  if (data.collectedBy !== undefined) payload.collectedBy = serializeCollectedBy(data.collectedBy);
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.revenues, id, payload);
  return fromDoc(doc);
}

export async function softDeleteRevenue(id: string, reason: string): Promise<void> {
  await databases.updateDocument(DB_ID, COLLECTIONS.revenues, id, {
    deletedAt: new Date().toISOString(),
    deleteReason: reason,
  });
}
