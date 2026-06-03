import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { OrchestratorRun, RunStatus, RiskLevel, SenderRole } from "@/lib/orchestrator/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fromDoc(doc: Models.Document): OrchestratorRun {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    source: rest.source as string,
    senderPhone: rest.senderPhone as string | null,
    senderRole: rest.senderRole as SenderRole,
    contactId: rest.contactId as string | null,
    dealId: rest.dealId as string | null,
    projectId: rest.projectId as string | null,
    intent: rest.intent as string,
    workflow: rest.workflow as string | null,
    status: rest.status as RunStatus,
    commandText: rest.commandText as string,
    resultSummary: rest.resultSummary as string | null,
    riskLevel: rest.riskLevel as RiskLevel,
    autodeploy: rest.autodeploy as boolean,
    currentStep: rest.currentStep as string | null,
    finalUrl: rest.finalUrl as string | null,
    repoUrl: rest.repoUrl as string | null,
    conversationId: rest.conversationId as string | null,
    error: rest.error as string | null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listOrchestratorRuns(filters?: {
  status?: RunStatus;
  senderPhone?: string;
  limit?: number;
}): Promise<OrchestratorRun[]> {
  const queries: string[] = [
    Query.limit(filters?.limit ?? 200),
    Query.orderDesc("$createdAt"),
  ];

  if (filters?.status) {
    queries.push(Query.equal("status", filters.status));
  }
  if (filters?.senderPhone) {
    queries.push(Query.equal("senderPhone", filters.senderPhone));
  }

  const res = await databases.listDocuments(
    DB_ID,
    COLLECTIONS.orchestratorRuns,
    queries,
  );
  return res.documents.map((d) => fromDoc(d));
}

export async function getOrchestratorRun(id: string): Promise<OrchestratorRun | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.orchestratorRuns, id);
    return fromDoc(doc);
  } catch {
    return null;
  }
}

export async function createOrchestratorRun(data: {
  source: string;
  senderPhone: string | null;
  senderRole: SenderRole;
  commandText: string;
  intent?: string;
  workflow?: string | null;
  status?: RunStatus;
  riskLevel?: RiskLevel;
  autodeploy?: boolean;
  conversationId?: string | null;
}): Promise<OrchestratorRun> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.orchestratorRuns,
    ID.unique(),
    {
      source: data.source,
      senderPhone: data.senderPhone ?? null,
      senderRole: data.senderRole,
      contactId: null,
      dealId: null,
      projectId: null,
      intent: data.intent ?? "unknown",
      workflow: data.workflow ?? null,
      status: data.status ?? "running",
      commandText: data.commandText,
      resultSummary: null,
      riskLevel: data.riskLevel ?? "low",
      autodeploy: data.autodeploy ?? false,
      currentStep: null,
      finalUrl: null,
      repoUrl: null,
      conversationId: data.conversationId ?? null,
      error: null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc(doc);
}

export async function updateOrchestratorRun(
  id: string,
  data: Partial<{
    contactId: string | null;
    dealId: string | null;
    projectId: string | null;
    intent: string;
    workflow: string | null;
    status: RunStatus;
    resultSummary: string | null;
    riskLevel: RiskLevel;
    autodeploy: boolean;
    currentStep: string | null;
    finalUrl: string | null;
    repoUrl: string | null;
    conversationId: string | null;
    error: string | null;
  }>,
): Promise<OrchestratorRun> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.orchestratorRuns, id, payload);
  return fromDoc(doc);
}
