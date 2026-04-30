import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Activity } from "@/types";
import { getContact } from "./contacts";

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

/** Activity extended with contactName for denormalized reads. */
export interface ActivityWithContact extends Activity {
  contactName?: string | null;
}

// ---------------------------------------------------------------------------
// listActivities
// ---------------------------------------------------------------------------

export async function listActivities(filters?: {
  contactId?: string;
  dealId?: string;
  isCompleted?: boolean;
}): Promise<ActivityWithContact[]> {
  const queries: string[] = [Query.limit(500), Query.orderDesc("$createdAt")];

  if (filters?.contactId) {
    queries.push(Query.equal("contactId", filters.contactId));
  }
  if (filters?.dealId) {
    queries.push(Query.equal("dealId", filters.dealId));
  }
  if (filters?.isCompleted !== undefined) {
    queries.push(Query.equal("isCompleted", filters.isCompleted));
  }

  const res = await databases.listDocuments(
    DB_ID,
    COLLECTIONS.activities,
    queries,
  );
  return res.documents.map((d) => fromDoc<ActivityWithContact>(d));
}

// ---------------------------------------------------------------------------
// createActivity
// ---------------------------------------------------------------------------

export async function createActivity(data: {
  type: string;
  description: string;
  contactId: string;
  dealId?: string | null;
  scheduledAt?: Date | string | number | null;
  startAt?: Date | string | number | null;
  endAt?: Date | string | number | null;
  notes?: string | null;
  attachments?: string | null;
  completedAt?: Date | string | number | null;
  isCompleted?: boolean;
}): Promise<ActivityWithContact> {
  let contactName: string | null = null;
  const contact = await getContact(data.contactId);
  if (contact) {
    contactName = contact.name;
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    type: data.type,
    description: data.description,
    contactId: data.contactId,
    dealId: data.dealId ?? null,
    scheduledAt: toIsoDate(data.scheduledAt),
    startAt: toIsoDate(data.startAt),
    endAt: toIsoDate(data.endAt),
    notes: data.notes ?? null,
    attachments: data.attachments ?? null,
    completedAt: toIsoDate(data.completedAt),
    isCompleted: data.isCompleted ?? false,
    contactName,
    createdAt: now,
  };

  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.activities,
    ID.unique(),
    payload,
  );
  return fromDoc<ActivityWithContact>(doc);
}

// ---------------------------------------------------------------------------
// updateActivity
// ---------------------------------------------------------------------------

export async function updateActivity(
  id: string,
  data: Partial<{
    type: string;
    description: string;
    contactId: string;
    dealId: string | null;
    scheduledAt: Date | string | number | null;
    completedAt: Date | string | number | null;
    isCompleted: boolean;
  }>,
): Promise<ActivityWithContact> {
  const payload: Record<string, unknown> = { ...data };

  if (data.scheduledAt !== undefined) {
    payload.scheduledAt = toIsoDate(data.scheduledAt);
  }
  if (data.completedAt !== undefined) {
    payload.completedAt = toIsoDate(data.completedAt);
  }

  // If contactId changed, re-resolve contactName
  if (data.contactId) {
    const contact = await getContact(data.contactId);
    payload.contactName = contact?.name ?? null;
  }

  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.activities,
    id,
    payload,
  );
  return fromDoc<ActivityWithContact>(doc);
}

// ---------------------------------------------------------------------------
// deleteActivity
// ---------------------------------------------------------------------------

export async function deleteActivity(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.activities, id);
}

// ---------------------------------------------------------------------------
// getPendingFollowups
// ---------------------------------------------------------------------------

export async function getPendingFollowups(): Promise<ActivityWithContact[]> {
  const now = new Date().toISOString();

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.activities, [
    Query.equal("isCompleted", false),
    Query.isNotNull("scheduledAt"),
    Query.lessThanEqual("scheduledAt", now),
    Query.orderAsc("scheduledAt"),
    Query.limit(200),
  ]);

  return res.documents.map((d) => fromDoc<ActivityWithContact>(d));
}
