import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type {
  AutomationRun,
  AutomationRunStatus,
  AutomationTrigger,
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

export async function listAutomationRuns(filters?: {
  leadId?: string;
  status?: AutomationRunStatus;
}): Promise<AutomationRun[]> {
  try {
    const queries: string[] = [Query.limit(200), Query.orderDesc("$createdAt")];
    if (filters?.leadId) queries.push(Query.equal("leadId", filters.leadId));
    if (filters?.status) queries.push(Query.equal("status", filters.status));
    const res = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.automationRuns,
      queries,
    );
    return res.documents.map((d) => fromDoc<AutomationRun>(d));
  } catch {
    return [];
  }
}

export async function createAutomationRun(data: {
  ruleId?: string | null;
  leadId: string;
  triggerType: AutomationTrigger;
  status?: AutomationRunStatus;
}): Promise<AutomationRun | null> {
  try {
    const now = new Date().toISOString();
    const doc = await databases.createDocument(
      DB_ID,
      COLLECTIONS.automationRuns,
      ID.unique(),
      {
        ruleId: data.ruleId ?? null,
        leadId: data.leadId,
        triggerType: data.triggerType,
        status: data.status ?? "running",
        actionsExecuted: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      },
    );
    return fromDoc<AutomationRun>(doc);
  } catch (e) {
    console.error("[automation-runs] create failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function updateAutomationRun(
  id: string,
  data: {
    status?: AutomationRunStatus;
    actionsExecuted?: string[];
    error?: string | null;
  },
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (data.status) payload.status = data.status;
    if (data.actionsExecuted) {
      payload.actionsExecuted = JSON.stringify(data.actionsExecuted);
    }
    if (data.error !== undefined) payload.error = data.error;
    await databases.updateDocument(DB_ID, COLLECTIONS.automationRuns, id, payload);
  } catch (e) {
    console.error("[automation-runs] update failed:", e instanceof Error ? e.message : e);
  }
}
