import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { CloseOutcome, Opportunity } from "@/types";
import { getDeal, updateDeal } from "./deals";
import { getStage, getStages } from "./pipeline";

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
    closedOutcome: string | null;
    closedReason: string | null;
    closedBy: string | null;
    closedAt: string | null;
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

/** Deleting something that is already gone is not an error (deal and opportunity delete each other) */
export async function deleteOpportunity(id: string): Promise<void> {
  try {
    await databases.deleteDocument(DB_ID, COLLECTIONS.opportunities, id);
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code === 404) return;
    throw e;
  }
}

export class CloseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Close an opportunity with a reason. It is NOT deleted: it stays in the customer
 * history as "chiusa". With an open deal, the deal is closed too (moved to the "lost"
 * stage with the same reason). If its deal is already won or lost, the opportunity
 * simply follows that outcome.
 */
export async function closeOpportunity(id: string, reason: string, by: string | null): Promise<Opportunity> {
  const opp = await getOpportunity(id);
  if (!opp) throw new CloseError("Opportunità non trovata", 404);
  if (opp.status === "chiusa") throw new CloseError("Opportunità già chiusa", 400);

  let outcome: CloseOutcome = "persa";
  if (opp.dealId) {
    const deal = await getDeal(opp.dealId);
    if (deal) {
      const current = await getStage(deal.stageId);
      if (current?.isWon) {
        outcome = "vinta";
      } else if (!current?.isLost) {
        const lost = (await getStages()).find((st) => st.isLost);
        if (!lost) throw new CloseError("Nel pipeline manca la fase «Persa»", 400);
        // closes the deal and (through updateDeal) every opportunity linked to it
        await updateDeal(deal.id, { stageId: lost.id, closedReason: reason, closedBy: by });
      }
    }
  }

  return updateOpportunity(id, {
    status: "chiusa",
    closedOutcome: outcome,
    closedReason: reason,
    closedBy: by,
    closedAt: new Date().toISOString(),
  });
}

/** Reopen a closed opportunity that has no deal (with a deal, the deal is reopened from the pipeline) */
export async function reopenOpportunity(id: string): Promise<Opportunity> {
  const opp = await getOpportunity(id);
  if (!opp) throw new CloseError("Opportunità non trovata", 404);
  if (opp.status !== "chiusa") throw new CloseError("L'opportunità non è chiusa", 400);
  if (opp.dealId && (await getDeal(opp.dealId))) {
    throw new CloseError("Riapri la trattativa spostandola fuori dalla fase «Persa»", 400);
  }
  return updateOpportunity(id, { status: "aperta", dealId: null, closedOutcome: null, closedReason: null, closedBy: null, closedAt: null });
}
