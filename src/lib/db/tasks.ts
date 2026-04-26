import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, Query, type Models } from "node-appwrite";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignedTo: string;
  createdBy: string;
  done: boolean;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIsoDate(
  d: Date | string | number | null | undefined,
): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "number")
    return new Date(d < 1e12 ? d * 1000 : d).toISOString();
  return new Date(d).toISOString();
}

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as T;
}

// ---------------------------------------------------------------------------
// listTasks
// ---------------------------------------------------------------------------

export async function listTasks(): Promise<Task[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.tasks, [
    Query.orderDesc("$createdAt"),
    Query.limit(500),
  ]);
  return res.documents.map((d) => {
    const task = fromDoc<Task>(d);
    // Convert string dates back to Date objects
    if (typeof task.dueAt === "string") {
      task.dueAt = new Date(task.dueAt);
    }
    return task;
  });
}

// ---------------------------------------------------------------------------
// createTask
// ---------------------------------------------------------------------------

export async function createTask(data: {
  title: string;
  description?: string | null;
  assignedTo: string;
  createdBy: string;
  dueAt?: Date | string | number | null;
}): Promise<Task> {
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.tasks,
    ID.unique(),
    {
      title: data.title,
      description: data.description ?? null,
      assignedTo: data.assignedTo,
      createdBy: data.createdBy,
      done: false,
      dueAt: toIsoDate(data.dueAt),
    },
  );
  const task = fromDoc<Task>(doc);
  if (typeof task.dueAt === "string") {
    task.dueAt = new Date(task.dueAt);
  }
  return task;
}

// ---------------------------------------------------------------------------
// updateTask
// ---------------------------------------------------------------------------

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    assignedTo: string;
    done: boolean;
    dueAt: Date | string | number | null;
  }>,
): Promise<Task> {
  const payload: Record<string, unknown> = { ...data };

  if (data.dueAt !== undefined) {
    payload.dueAt = toIsoDate(data.dueAt);
  }

  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.tasks,
    id,
    payload,
  );
  const task = fromDoc<Task>(doc);
  if (typeof task.dueAt === "string") {
    task.dueAt = new Date(task.dueAt);
  }
  return task;
}

// ---------------------------------------------------------------------------
// deleteTask
// ---------------------------------------------------------------------------

export async function deleteTask(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.tasks, id);
}
