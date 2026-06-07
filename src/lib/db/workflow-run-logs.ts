import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { WorkflowRunLog, LogStatus } from "@/lib/workflows/types";

function fromDoc(doc: Models.Document): WorkflowRunLog {
  const { $id, ...rest } = doc;
  return {
    id: $id,
    runId: rest.runId ?? "",
    nodeId: rest.nodeId ?? "",
    nodeType: rest.nodeType ?? "",
    status: (rest.status ?? "pending") as LogStatus,
    input: rest.input ?? null,
    output: rest.output ?? null,
    error: rest.error ?? null,
    executedAt: new Date(rest.executedAt ?? doc.$createdAt),
  };
}

export async function listWorkflowRunLogs(
  runId: string,
  pagination?: { offset?: number; limit?: number },
): Promise<WorkflowRunLog[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.workflowRunLogs, [
    Query.equal("runId", runId),
    Query.limit(pagination?.limit ?? 500),
    Query.offset(pagination?.offset ?? 0),
    Query.orderAsc("executedAt"),
  ]);
  return res.documents.map(fromDoc);
}

export async function getWorkflowRunLog(id: string): Promise<WorkflowRunLog | null> {
  try {
    return fromDoc(await databases.getDocument(DB_ID, COLLECTIONS.workflowRunLogs, id));
  } catch {
    return null;
  }
}

export async function createWorkflowRunLog(data: {
  runId: string;
  nodeId: string;
  nodeType: string;
  status?: LogStatus;
  input?: string | null;
  output?: string | null;
  error?: string | null;
}): Promise<WorkflowRunLog> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.workflowRunLogs, ID.unique(), {
    runId: data.runId,
    nodeId: data.nodeId,
    nodeType: data.nodeType,
    status: data.status ?? "pending",
    input: data.input ?? null,
    output: data.output ?? null,
    error: data.error ?? null,
    executedAt: now,
  });
  return fromDoc(doc);
}

export async function updateWorkflowRunLog(
  id: string,
  data: Partial<{
    status: LogStatus;
    input: string | null;
    output: string | null;
    error: string | null;
  }>,
): Promise<WorkflowRunLog> {
  const payload: Record<string, unknown> = { ...data };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.workflowRunLogs, id, payload);
  return fromDoc(doc);
}
