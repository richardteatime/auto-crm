import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { DealWithContact } from "@/types";
import { getContact } from "./contacts";
import { getStage, getStages } from "./pipeline";
import { parseDoc } from "./parse-doc";
import { DealSchema } from "./schemas";

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
  stageIsWon?: boolean;
}> {
  const result: Record<string, unknown> = {};

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
      result.stageIsWon = stage.isWon;
    }
  }

  return result as {
    contactName?: string;
    contactTemperature?: string;
    stageName?: string;
    stageColor?: string;
    stageIsWon?: boolean;
  };
}

// ---------------------------------------------------------------------------
// listDeals
// ---------------------------------------------------------------------------

export async function listDeals(
  filters?: {
    stageId?: string;
    contactId?: string;
  },
  pagination?: { offset?: number; limit?: number },
): Promise<DealWithContact[]> {
  const queries: string[] = [
    Query.limit(pagination?.limit ?? 500),
    Query.offset(pagination?.offset ?? 0),
    Query.orderDesc("$createdAt"),
  ];

  if (filters?.stageId) {
    queries.push(Query.equal("stageId", filters.stageId));
  }
  if (filters?.contactId) {
    queries.push(Query.equal("contactId", filters.contactId));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.deals, queries);
  return res.documents.map((d) => parseDoc(DealSchema,d));
}

// ---------------------------------------------------------------------------
// getDeal
// ---------------------------------------------------------------------------

export async function getDeal(id: string): Promise<DealWithContact | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.deals, id);
    return parseDoc(DealSchema,doc);
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
  billingType?: import("@/types").BillingType;
  recurringMonths?: number | null;
  isPaid?: boolean;
  createdBy?: string | null;
}): Promise<DealWithContact> {
  // Se non passano uno stage, mettiamo il deal nel primo stage della pipeline.
  let stageId = data.stageId;
  if (!stageId) {
    const stages = await getStages();
    stageId = stages[0]?.id ?? "";
  }

  const denorm = await resolveDenormFields(data.contactId, stageId);

  const wonAt =
    denorm.stageIsWon ? new Date().toISOString() : undefined;

  const billingType = data.billingType ?? "una_tantum";
  const recurringStartDate =
    billingType !== "una_tantum" ? new Date().toISOString() : undefined;

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    title: data.title,
    value: data.value ?? 0,
    stageId,
    contactId: data.contactId,
    expectedClose: toIsoDate(data.expectedClose),
    probability: denorm.stageIsWon ? 100 : (data.probability ?? 0),
    notes: data.notes ?? null,
    attachments: data.attachments ?? null,
    billingType,
    recurringMonths: data.recurringMonths ?? null,
    recurringStartDate,
    wonAt,
    isPaid: data.isPaid ?? false,
    createdBy: data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.deals,
    ID.unique(),
    payload,
  );
  return parseDoc(DealSchema,doc);
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
    billingType: import("@/types").BillingType;
    recurringMonths: number | null;
    isPaid: boolean;
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

  // If stage changed, check isWon (already fetched by resolveDenormFields)
  if (data.stageId) {
    if (denorm.stageIsWon) {
      payload.wonAt = existing?.wonAt ?? new Date().toISOString();
      payload.probability = 100;
    }
    // If moved away from won stage, clear wonAt
    if (!denorm.stageIsWon && existing?.wonAt) {
      payload.wonAt = null;
    }
  }

  // If billingType changed to recurring and no recurringStartDate, set it
  if (data.billingType && data.billingType !== "una_tantum" && !existing?.recurringStartDate) {
    payload.recurringStartDate = new Date().toISOString();
  }

  // Denormalized fields (contactName, contactTemperature, stageName, stageColor)
  // are omitted from create/update payloads to avoid "Unknown attribute" errors
  // on Appwrite instances that haven't run `npm run setup` after these fields
  // were added. They are declared as .optional() in DealSchema so parseDoc works.

  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.deals,
    id,
    payload,
  );
  return parseDoc(DealSchema,doc);
}

// ---------------------------------------------------------------------------
// deleteDeal
// ---------------------------------------------------------------------------

export async function deleteDeal(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.deals, id);
}
