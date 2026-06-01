import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Workflow, WorkflowStatus } from "@/lib/workflows/types";

function fromDoc(doc: Models.Document): Workflow {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    name: rest.name ?? "",
    description: rest.description ?? null,
    status: (rest.status ?? "draft") as WorkflowStatus,
    triggerType: rest.triggerType ?? "",
    triggerConfig: rest.triggerConfig ?? "{}",
    nodes: rest.nodes ?? "[]",
    edges: rest.edges ?? "[]",
    createdBy: rest.createdBy ?? null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

export async function listWorkflows(): Promise<Workflow[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.workflows, [
    Query.limit(500),
    Query.orderDesc("$createdAt"),
  ]);
  return res.documents.map(fromDoc);
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    return fromDoc(await databases.getDocument(DB_ID, COLLECTIONS.workflows, id));
  } catch {
    return null;
  }
}

export async function createWorkflow(data: {
  name: string;
  description?: string | null;
  triggerType?: string;
  triggerConfig?: string;
  nodes?: string;
  edges?: string;
  createdBy?: string | null;
}): Promise<Workflow> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.workflows, ID.unique(), {
    name: data.name,
    description: data.description ?? null,
    status: "draft",
    triggerType: data.triggerType ?? "contact_created",
    triggerConfig: data.triggerConfig ?? "{}",
    nodes: data.nodes ?? "[]",
    edges: data.edges ?? "[]",
    createdBy: data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return fromDoc(doc);
}

export async function updateWorkflow(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    status: WorkflowStatus;
    triggerType: string;
    triggerConfig: string;
    nodes: string;
    edges: string;
  }>,
): Promise<Workflow> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.workflows, id, payload);
  return fromDoc(doc);
}

export async function deleteWorkflow(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.workflows, id);
}

export async function listActiveWorkflowsByTrigger(triggerType: string): Promise<Workflow[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.workflows, [
    Query.equal("status", "active"),
    Query.equal("triggerType", triggerType),
    Query.limit(500),
  ]);
  return res.documents.map(fromDoc);
}
