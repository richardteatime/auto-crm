import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { AgentTask } from "@/lib/orchestrator/types";

function fromDoc(doc: Models.Document): AgentTask {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    runId: rest.runId as string,
    agentName: rest.agentName as string,
    taskType: rest.taskType as string,
    status: rest.status as AgentTask["status"],
    input: rest.input as string,
    output: rest.output as string | null,
    error: rest.error as string | null,
    startedAt: rest.startedAt ? new Date(rest.startedAt) : null,
    completedAt: rest.completedAt ? new Date(rest.completedAt) : null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

export async function listAgentTasks(
  filters?: {
    runId?: string;
    status?: AgentTask["status"];
  },
  pagination?: { offset?: number; limit?: number },
): Promise<AgentTask[]> {
  const queries: string[] = [
    Query.limit(pagination?.limit ?? 200),
    Query.offset(pagination?.offset ?? 0),
    Query.orderDesc("$createdAt"),
  ];

  if (filters?.runId) {
    queries.push(Query.equal("runId", filters.runId));
  }
  if (filters?.status) {
    queries.push(Query.equal("status", filters.status));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.agentTasks, queries);
  return res.documents.map((d) => fromDoc(d));
}

export async function getAgentTask(id: string): Promise<AgentTask | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.agentTasks, id);
    return fromDoc(doc);
  } catch {
    return null;
  }
}

export async function createAgentTask(data: {
  runId: string;
  agentName: string;
  taskType: string;
  status?: AgentTask["status"];
  input?: string;
  output?: string | null;
  error?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
}): Promise<AgentTask> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.agentTasks,
    ID.unique(),
    {
      runId: data.runId,
      agentName: data.agentName,
      taskType: data.taskType,
      status: data.status ?? "pending",
      input: data.input ?? "",
      output: data.output ?? null,
      error: data.error ?? null,
      startedAt: data.startedAt ? new Date(data.startedAt).toISOString() : null,
      completedAt: data.completedAt ? new Date(data.completedAt).toISOString() : null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc(doc);
}

export async function updateAgentTask(
  id: string,
  data: Partial<{
    status: AgentTask["status"];
    output: string | null;
    error: string | null;
    startedAt: Date | string | null;
    completedAt: Date | string | null;
  }>,
): Promise<AgentTask> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  if (data.startedAt !== undefined) {
    payload.startedAt = data.startedAt ? new Date(data.startedAt).toISOString() : null;
  }
  if (data.completedAt !== undefined) {
    payload.completedAt = data.completedAt ? new Date(data.completedAt).toISOString() : null;
  }

  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.agentTasks, id, payload);
  return fromDoc(doc);
}

export async function deleteAgentTask(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.agentTasks, id);
}
