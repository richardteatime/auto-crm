import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { CallTask, CallTaskStatus, CallOutcome } from "@/lib/leads/types";

function toIso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

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

export async function listCallTasks(filters?: {
  leadId?: string;
  assignedTo?: string;
  status?: CallTaskStatus;
}): Promise<CallTask[]> {
  try {
    const queries: string[] = [Query.limit(200), Query.orderDesc("$createdAt")];
    if (filters?.leadId) queries.push(Query.equal("leadId", filters.leadId));
    if (filters?.assignedTo) {
      queries.push(Query.equal("assignedTo", filters.assignedTo));
    }
    if (filters?.status) queries.push(Query.equal("status", filters.status));
    const res = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.callTasks,
      queries,
    );
    return res.documents.map((d) => fromDoc<CallTask>(d));
  } catch {
    return [];
  }
}

export async function getCallTask(id: string): Promise<CallTask | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.callTasks, id);
    return fromDoc<CallTask>(doc);
  } catch {
    return null;
  }
}

export async function createCallTask(data: {
  leadId: string;
  assignedTo: string;
  assigneeName?: string | null;
  status?: CallTaskStatus;
  scheduledAt?: Date | string | null;
  notes?: string | null;
}): Promise<CallTask> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.callTasks,
    ID.unique(),
    {
      leadId: data.leadId,
      assignedTo: data.assignedTo,
      assigneeName: data.assigneeName ?? null,
      status: data.status ?? "pending",
      scheduledAt: toIso(data.scheduledAt) ?? null,
      completedAt: null,
      callOutcome: null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc<CallTask>(doc);
}

export async function updateCallTask(
  id: string,
  data: Partial<{
    status: CallTaskStatus;
    scheduledAt: Date | string | null;
    completedAt: Date | string | null;
    callOutcome: CallOutcome | null;
    notes: string | null;
  }>,
): Promise<CallTask> {
  const payload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (data.status !== undefined) payload.status = data.status;
  if (data.callOutcome !== undefined) payload.callOutcome = data.callOutcome;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (data.scheduledAt !== undefined) {
    payload.scheduledAt = data.scheduledAt ? toIso(data.scheduledAt) : null;
  }
  if (data.completedAt !== undefined) {
    payload.completedAt = data.completedAt ? toIso(data.completedAt) : null;
  }

  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.callTasks,
    id,
    payload,
  );
  return fromDoc<CallTask>(doc);
}

export async function getOpenCallTaskForLead(
  leadId: string,
): Promise<CallTask | null> {
  const tasks = await listCallTasks({ leadId });
  return (
    tasks.find((t) => t.status === "pending" || t.status === "scheduled") ??
    null
  );
}
