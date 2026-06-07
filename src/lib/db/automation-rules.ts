import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { AutomationRule, AutomationTrigger } from "@/lib/leads/types";

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

export async function listAutomationRules(
  filters?: {
    triggerType?: AutomationTrigger;
    enabledOnly?: boolean;
  },
  pagination?: { offset?: number; limit?: number },
): Promise<AutomationRule[]> {
  try {
    const queries: string[] = [
      Query.limit(pagination?.limit ?? 200),
      Query.offset(pagination?.offset ?? 0),
      Query.orderDesc("$createdAt"),
    ];
    if (filters?.triggerType) {
      queries.push(Query.equal("triggerType", filters.triggerType));
    }
    if (filters?.enabledOnly) {
      queries.push(Query.equal("enabled", true));
    }
    const res = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.automationRules,
      queries,
    );
    return res.documents.map((d) => fromDoc<AutomationRule>(d));
  } catch {
    return [];
  }
}

export async function createAutomationRule(data: {
  name: string;
  enabled?: boolean;
  triggerType: AutomationTrigger;
  pipelineStage?: string | null;
  leadCategory?: string | null;
  conditions?: Record<string, unknown> | null;
  actions?: string[] | null;
}): Promise<AutomationRule> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.automationRules,
    ID.unique(),
    {
      name: data.name,
      enabled: data.enabled ?? true,
      triggerType: data.triggerType,
      pipelineStage: data.pipelineStage ?? null,
      leadCategory: data.leadCategory ?? null,
      conditions: data.conditions ? JSON.stringify(data.conditions) : null,
      actions: data.actions ? JSON.stringify(data.actions) : null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc<AutomationRule>(doc);
}

export async function updateAutomationRule(
  id: string,
  data: Partial<{ enabled: boolean; actions: string[]; name: string }>,
): Promise<AutomationRule> {
  const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.enabled !== undefined) payload.enabled = data.enabled;
  if (data.name !== undefined) payload.name = data.name;
  if (data.actions !== undefined) payload.actions = JSON.stringify(data.actions);
  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.automationRules,
    id,
    payload,
  );
  return fromDoc<AutomationRule>(doc);
}
