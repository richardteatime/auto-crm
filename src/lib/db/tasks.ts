import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Task } from "@/types";

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, createdAt, updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as T;
}

function toIso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  return new Date(d).toISOString();
}

export async function listTasks(filters?: {
  assignedTo?: string;
  done?: boolean;
}): Promise<Task[]> {
  const queries: string[] = [Query.limit(500), Query.orderDesc("$createdAt")];

  if (filters?.assignedTo) {
    queries.push(Query.equal("assignedTo", filters.assignedTo));
  }
  if (filters?.done !== undefined) {
    queries.push(Query.equal("done", filters.done));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.tasks, queries);
  return res.documents.map((d) => fromDoc<Task>(d));
}

export async function getTask(id: string): Promise<Task | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.tasks, id);
    return fromDoc<Task>(doc);
  } catch {
    return null;
  }
}

export async function createTask(data: {
  title: string;
  description?: string | null;
  assignedTo?: string;
  createdBy?: string;
  done?: boolean;
  dueAt?: Date | string | null;
}): Promise<Task> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.tasks,
    ID.unique(),
    {
      title: data.title,
      description: data.description ?? null,
      assignedTo: data.assignedTo ?? "orchestrator",
      createdBy: data.createdBy ?? "orchestrator",
      done: data.done ?? false,
      dueAt: toIso(data.dueAt) ?? null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc<Task>(doc);
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    assignedTo: string;
    done: boolean;
    dueAt: Date | string | null;
  }>,
): Promise<Task> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  if (data.dueAt !== undefined) payload.dueAt = toIso(data.dueAt) ?? null;

  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.tasks,
    id,
    payload,
  );
  return fromDoc<Task>(doc);
}

export async function deleteTask(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.tasks, id);
}
