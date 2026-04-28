import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Deal, DealWithContact, PipelineStage } from "@/types";
import { getContact } from "./contacts";
import { getStage } from "./pipeline";

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

// ---------------------------------------------------------------------------
// Denormalization helper
// ---------------------------------------------------------------------------

async function resolveDenormFields(
  contactId?: string | null,
  stageId?: string | null,
): Promise<{
  contactName?: string;
  contactTemperature?: string;
  stageName?: string;
  stageColor?: string;
}> {
  const result: Record<string, string> = {};

  if (contactId) {
    const contact = await getContact(contactId);
    if (contact) {
      result.contactName = contact.name;
      result.contactTemperature = contact.temperature;
    }
  }

  if (stageId) {
    const stage = await getStage(stageId);
    if (stage) {
      result.stageName = stage.name;
      result.stageColor = stage.color;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// listDeals
// ---------------------------------------------------------------------------

export async function listDeals(filters?: {
  stageId?: string;
  contactId?: string;
}): Promise<DealWithContact[]> {
  const queries: string[] = [Query.limit(500), Query.orderDesc("$createdAt")];

  if (filters?.stageId) {
    queries.push(Query.equal("stageId", filters.stageId));
  }
  if (filters?.contactId) {
    queries.push(Query.equal("contactId", filters.contactId));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.deals, queries);
  return res.documents.map((d) => fromDoc<DealWithContact>(d));
}

// ---------------------------------------------------------------------------
// getDeal
// ---------------------------------------------------------------------------

export async function getDeal(id: string): Promise<DealWithContact | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.deals, id);
    return fromDoc<DealWithContact>(doc);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// createDeal
// ---------------------------------------------------------------------------

export async function createDeal(data: {
  title: string;
  value?: number;
  stageId?: string;
  contactId: string;
  expectedClose?: Date | string | number | null;
  probability?: number;
  notes?: string | null;
  attachments?: string | null;
  isRecurring?: boolean;
  recurringMonths?: number | null;
}): Promise<DealWithContact> {
  const denorm = await resolveDenormFields(data.contactId, data.stageId);

  const stage =
    data.stageId ? await getStage(data.stageId) : null;
  const wonAt =
    stage?.isWon ? new Date().toISOString() : undefined;

  const isRecurring = data.isRecurring ?? false;
  const recurringStartDate =
    isRecurring ? new Date().toISOString() : undefined;

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    title: data.title,
    value: data.value ?? 0,
    stageId: data.stageId ?? "",
    contactId: data.contactId,
    expectedClose: toIsoDate(data.expectedClose),
    probability: data.probability ?? 0,
    notes: data.notes ?? null,
    attachments: data.attachments ?? null,
    isRecurring,
    recurringMonths: data.recurringMonths ?? null,
    recurringStartDate,
    wonAt,
    contactName: denorm.contactName ?? null,
    contactTemperature: denorm.contactTemperature ?? null,
    stageName: denorm.stageName ?? null,
    stageColor: denorm.stageColor ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.deals,
    ID.unique(),
    payload,
  );
  return fromDoc<DealWithContact>(doc);
}

// ---------------------------------------------------------------------------
// updateDeal
// ---------------------------------------------------------------------------

export async function updateDeal(
  id: string,
  data: Partial<{
    title: string;
    value: number;
    stageId: string;
    contactId: string;
    expectedClose: Date | string | number | null;
    probability: number;
    notes: string | null;
    attachments: string | null;
    isRecurring: boolean;
    recurringMonths: number | null;
  }>,
): Promise<DealWithContact> {
  // Resolve denormalized fields if contact or stage changed
  const existing = await getDeal(id);
  const contactId = data.contactId ?? existing?.contactId;
  const stageId = data.stageId ?? existing?.stageId;

  const denorm = await resolveDenormFields(contactId, stageId);

  const payload: Record<string, unknown> = { ...data };

  if (data.expectedClose !== undefined) {
    payload.expectedClose = toIsoDate(data.expectedClose);
  }

  // If stage changed, check isWon
  if (data.stageId) {
    const stage = await getStage(data.stageId);
    if (stage?.isWon && !existing?.wonAt) {
      payload.wonAt = new Date().toISOString();
    }
    // If moved away from won stage, clear wonAt
    if (!stage?.isWon && existing?.wonAt) {
      payload.wonAt = null;
    }
  }

  // If isRecurring turned on and no recurringStartDate, set it
  if (data.isRecurring && !existing?.recurringStartDate) {
    payload.recurringStartDate = new Date().toISOString();
  }

  payload.contactName = denorm.contactName ?? existing?.contactName ?? null;
  payload.contactTemperature =
    denorm.contactTemperature ?? existing?.contactTemperature ?? null;
  // stageName and stageColor are denormalized fields stored in the document
  // but not declared on the DealWithContact TS type
  const extra = payload as Record<string, unknown>;
  const existingExtra = existing as unknown as Record<string, unknown> | null;
  extra.stageName =
    denorm.stageName ?? existingExtra?.stageName ?? null;
  extra.stageColor =
    denorm.stageColor ?? existingExtra?.stageColor ?? null;

  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.deals,
    id,
    payload,
  );
  return fromDoc<DealWithContact>(doc);
}

// ---------------------------------------------------------------------------
// deleteDeal
// ---------------------------------------------------------------------------

export async function deleteDeal(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.deals, id);
}
