import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Project, ProjectLog, ProjectStatus } from "@/types";

function parseAssignedTo(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
      // legacy single string
      return [value];
    } catch {
      return [value];
    }
  }
  return [];
}

function serializeAssignedTo(value: string[] | undefined | null): string | null {
  if (!value || value.length === 0) return null;
  return JSON.stringify(value);
}

function fromDoc<T extends Project | ProjectLog>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  const base = {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as Record<string, unknown>;
  if ("assignedTo" in base) {
    base.assignedTo = parseAssignedTo(base.assignedTo);
  }
  return base as T;
}

function toIso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  return new Date(d).toISOString();
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.projects, [
    Query.limit(500),
    Query.orderDesc("$createdAt"),
  ]);
  return res.documents.map((d) => fromDoc<Project>(d));
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.projects, id);
    return fromDoc<Project>(doc);
  } catch {
    return null;
  }
}

export async function createProject(data: {
  title: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: string | null;
  assignedTo?: string[] | null;
  startDate?: Date | string | null;
  dueDate?: Date | string | null;
  notes?: string | null;
  contactId?: string | null;
  dealId?: string | null;
}): Promise<Project> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.projects, ID.unique(), {
    title: data.title,
    description: data.description ?? null,
    status: data.status ?? "aperto",
    priority: data.priority ?? "media",
    assignedTo: serializeAssignedTo(data.assignedTo),
    startDate: toIso(data.startDate) ?? null,
    dueDate: toIso(data.dueDate) ?? null,
    deliveredAt: null,
    notes: data.notes ?? null,
    contactId: data.contactId ?? null,
    dealId: data.dealId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return fromDoc<Project>(doc);
}

export async function updateProject(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    status: ProjectStatus;
    priority: string | null;
    assignedTo: string[] | null;
    startDate: Date | string | null;
    dueDate: Date | string | null;
    deliveredAt: Date | string | null;
    notes: string | null;
    contactId: string | null;
    dealId: string | null;
  }>,
): Promise<Project> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  if (data.startDate !== undefined) payload.startDate = toIso(data.startDate) ?? null;
  if (data.dueDate !== undefined) payload.dueDate = toIso(data.dueDate) ?? null;
  if (data.deliveredAt !== undefined) payload.deliveredAt = toIso(data.deliveredAt) ?? null;
  if (data.assignedTo !== undefined) payload.assignedTo = serializeAssignedTo(data.assignedTo);
  if (data.status === "consegnato" && !data.deliveredAt) {
    payload.deliveredAt = new Date().toISOString();
  }
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.projects, id, payload);
  return fromDoc<Project>(doc);
}

export async function deleteProject(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.projects, id);
}

// ---------------------------------------------------------------------------
// Project Logs
// ---------------------------------------------------------------------------

export async function listProjectLogs(projectId: string): Promise<ProjectLog[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.projectLogs, [
    Query.equal("projectId", projectId),
    Query.limit(200),
    Query.orderDesc("$createdAt"),
  ]);
  return res.documents.map((d) => fromDoc<ProjectLog>(d));
}

export async function createProjectLog(data: {
  projectId: string;
  fromStatus: string | null;
  toStatus: string;
  notes: string;
}): Promise<ProjectLog> {
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.projectLogs,
    ID.unique(),
    {
      projectId: data.projectId,
      fromStatus: data.fromStatus ?? null,
      toStatus: data.toStatus,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    },
  );
  return fromDoc<ProjectLog>(doc);
}
