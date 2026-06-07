import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { WorkflowScheduled, ScheduledStatus } from "@/lib/workflows/types";

function fromDoc(doc: Models.Document): WorkflowScheduled {
  const { $id, $createdAt, ...rest } = doc;
  return {
    id: $id,
    workflowId: rest.workflowId ?? "",
    runId: rest.runId ?? "",
    nodeId: rest.nodeId ?? "",
    executeAt: new Date(rest.executeAt ?? $createdAt),
    payload: rest.payload ?? "{}",
    status: (rest.status ?? "pending") as ScheduledStatus,
    workerId: rest.workerId ?? undefined,
    startedAt: rest.startedAt ? new Date(rest.startedAt) : undefined,
    createdAt: new Date($createdAt),
  };
}

export async function listWorkflowScheduled(
  status?: ScheduledStatus,
  before?: Date,
  pagination?: { offset?: number; limit?: number },
): Promise<WorkflowScheduled[]> {
  const queries = [
    Query.limit(pagination?.limit ?? 500),
    Query.offset(pagination?.offset ?? 0),
    Query.orderAsc("executeAt"),
  ];
  if (status) queries.push(Query.equal("status", status));
  if (before) queries.push(Query.lessThanEqual("executeAt", before.toISOString()));
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.workflowScheduled, queries);
  return res.documents.map(fromDoc);
}

export async function getWorkflowScheduled(id: string): Promise<WorkflowScheduled | null> {
  try {
    return fromDoc(await databases.getDocument(DB_ID, COLLECTIONS.workflowScheduled, id));
  } catch {
    return null;
  }
}

export async function createWorkflowScheduled(data: {
  workflowId: string;
  runId: string;
  nodeId: string;
  executeAt: Date;
  payload: string;
  status?: ScheduledStatus;
}): Promise<WorkflowScheduled> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.workflowScheduled, ID.unique(), {
    workflowId: data.workflowId,
    runId: data.runId,
    nodeId: data.nodeId,
    executeAt: data.executeAt.toISOString(),
    payload: data.payload,
    status: data.status ?? "pending",
    createdAt: now,
  });
  return fromDoc(doc);
}

export async function updateWorkflowScheduled(
  id: string,
  data: Partial<{
    status: ScheduledStatus;
    executeAt: string;
    payload: string;
    workerId: string;
    startedAt: string;
  }>,
): Promise<WorkflowScheduled> {
  const payload: Record<string, unknown> = { ...data };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.workflowScheduled, id, payload);
  return fromDoc(doc);
}

export async function deleteWorkflowScheduled(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.workflowScheduled, id);
}
