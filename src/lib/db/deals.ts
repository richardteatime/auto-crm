import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { CloseOutcome, Deal, DealWithContact, PipelineStage } from "@/types";
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
  billingType?: import("@/types").BillingType;
  recurringMonths?: number | null;
  isPaid?: boolean;
}): Promise<DealWithContact> {
  const denorm = await resolveDenormFields(data.contactId, data.stageId);

  const stage =
    data.stageId ? await getStage(data.stageId) : null;
  const wonAt =
    stage?.isWon ? new Date().toISOString() : undefined;

  const billingType = data.billingType ?? "una_tantum";
  const recurringStartDate =
    billingType !== "una_tantum" ? new Date().toISOString() : undefined;

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    title: data.title,
    value: data.value ?? 0,
    stageId: data.stageId ?? "",
    contactId: data.contactId,
    expectedClose: toIsoDate(data.expectedClose),
    probability: stage?.isWon ? 100 : (data.probability ?? 0),
    notes: data.notes ?? null,
    attachments: data.attachments ?? null,
    billingType,
    recurringMonths: data.recurringMonths ?? null,
    recurringStartDate,
    wonAt,
    isPaid: data.isPaid ?? false,
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
    billingType: import("@/types").BillingType;
    recurringMonths: number | null;
    isPaid: boolean;
    partnerFeePct: number | null;
    /** Why the deal is being closed (used when the stage becomes a "won" or "lost" one) */
    closedReason: string | null;
    closedBy: string | null;
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

  // If stage changed, check isWon / isLost
  let closeSync: "closed" | "reopened" | null = null;
  if (data.stageId) {
    const stage = await getStage(data.stageId);
    if (stage?.isWon) {
      payload.wonAt = existing?.wonAt ?? new Date().toISOString();
      payload.probability = 100;
    }
    // If moved away from won stage, clear wonAt
    if (!stage?.isWon && existing?.wonAt) {
      payload.wonAt = null;
    }
    // Closed (won or lost): keep outcome/why/who/when. Moving it back to an open stage reopens it.
    const toOutcome = outcomeOfStage(stage);
    const fromOutcome = outcomeOfStage(existing?.stageId ? await getStage(existing.stageId) : null);
    if (toOutcome && toOutcome !== fromOutcome) {
      payload.closedOutcome = toOutcome;
      payload.closedAt = new Date().toISOString();
      payload.closedReason = data.closedReason ?? null;
      payload.closedBy = data.closedBy ?? null;
      closeSync = "closed";
    } else if (!toOutcome && fromOutcome) {
      payload.closedOutcome = null;
      payload.closedAt = null;
      payload.closedReason = null;
      payload.closedBy = null;
      closeSync = "reopened";
    } else if (!toOutcome) {
      // not a closing move: never store a reason on an open deal
      delete payload.closedReason;
      delete payload.closedBy;
    }
  } else {
    delete payload.closedReason;
    delete payload.closedBy;
  }

  // If billingType changed to recurring and no recurringStartDate, set it
  if (data.billingType && data.billingType !== "una_tantum" && !existing?.recurringStartDate) {
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

  // Keep the linked opportunity in step: closing the deal (won or lost) closes it with the
  // same outcome and reason, reopening the deal puts it back to "trasformata". Never deleted.
  if (closeSync) {
    await syncLinkedOpportunities(id, closeSync, {
      outcome: (payload.closedOutcome as CloseOutcome | null) ?? null,
      reason: (payload.closedReason as string | null) ?? null,
      by: (payload.closedBy as string | null) ?? null,
    });
  }
  return fromDoc<DealWithContact>(doc);
}

function outcomeOfStage(stage: { isWon?: boolean; isLost?: boolean } | null | undefined): CloseOutcome | null {
  return stage?.isWon ? "vinta" : stage?.isLost ? "persa" : null;
}

/**
 * True when moving `deal` to `stageId` closes it as won or lost, or changes how it was
 * closed (the caller must then give a reason). Moving to an open stage never needs one.
 */
export async function isClosingMove(
  deal: { stageId: string } | null,
  stageId: string,
): Promise<boolean> {
  if (!deal || deal.stageId === stageId) return false;
  const [target, current] = await Promise.all([getStage(stageId), getStage(deal.stageId)]);
  const to = outcomeOfStage(target);
  return !!to && to !== outcomeOfStage(current);
}

async function syncLinkedOpportunities(
  dealId: string,
  mode: "closed" | "reopened",
  info: { outcome: CloseOutcome | null; reason: string | null; by: string | null },
): Promise<void> {
  let docs: Models.Document[] = [];
  try {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.opportunities, [
      Query.equal("dealId", dealId),
      Query.limit(500),
    ]);
    docs = res.documents;
  } catch {
    return; // collection or attribute missing on this instance
  }
  const now = new Date().toISOString();
  for (const opp of docs) {
    const patch =
      mode === "closed"
        ? { status: "chiusa", closedOutcome: info.outcome, closedReason: info.reason, closedBy: info.by, closedAt: now, updatedAt: now }
        : opp.status === "chiusa"
          ? { status: "trasformata", closedOutcome: null, closedReason: null, closedBy: null, closedAt: null, updatedAt: now }
          : null;
    if (patch) await databases.updateDocument(DB_ID, COLLECTIONS.opportunities, opp.$id, patch);
  }
}
