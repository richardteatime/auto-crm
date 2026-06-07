import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { WorkflowRun, RunStatus } from "@/lib/workflows/types";

function fromDoc(doc: Models.Document): WorkflowRun {
  const { $id, $createdAt, ...rest } = doc;
  return {
    id: $id,
    workflowId: rest.workflowId ?? "",
    triggerType: rest.triggerType ?? "",
    triggerPayload: rest.triggerPayload ?? "{}",
    status: (rest.status ?? "running") as RunStatus,
    startedAt: new Date(rest.startedAt ?? $createdAt),
    completedAt: rest.completedAt ? new Date(rest.completedAt) : null,
    error: rest.error ?? null,
    createdAt: new Date($createdAt),
  };
}

export async function listWorkflowRuns(
  workflowId?: string,
  pagination?: { offset?: number; limit?: number },
): Promise<WorkflowRun[]> {
  const queries = [
    Query.limit(pagination?.limit ?? 500),
    Query.offset(pagination?.offset ?? 0),
    Query.orderDesc("$createdAt"),
  ];
  if (workflowId) queries.push(Query.equal("workflowId", workflowId));
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.workflowRuns, queries);
  return res.documents.map(fromDoc);
}

export async function getWorkflowRun(id: string): Promise<WorkflowRun | null> {
  try {
    return fromDoc(await databases.getDocument(DB_ID, COLLECTIONS.workflowRuns, id));
  } catch {
    return null;
  }
}

export async function createWorkflowRun(data: {
  workflowId: string;
  triggerType: string;
  triggerPayload: string;
  status?: RunStatus;
}): Promise<WorkflowRun> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.workflowRuns, ID.unique(), {
    workflowId: data.workflowId,
    triggerType: data.triggerType,
    triggerPayload: data.triggerPayload,
    status: data.status ?? "running",
    startedAt: now,
    completedAt: null,
    error: null,
    createdAt: now,
  });
  return fromDoc(doc);
}

export async function updateWorkflowRun(
  id: string,
  data: Partial<{
    status: RunStatus;
    completedAt: string;
    error: string | null;
  }>,
): Promise<WorkflowRun> {
  const payload: Record<string, unknown> = { ...data };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.workflowRuns, id, payload);
  return fromDoc(doc);
}

export async function deleteWorkflowRun(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.workflowRuns, id);
}
