import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Workflow, WorkflowStatus } from "@/lib/workflows/types";
import { parseDoc } from "./parse-doc";
import { WorkflowSchema } from "./schemas";

export async function listWorkflows(
  pagination?: { offset?: number; limit?: number },
): Promise<Workflow[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.workflows, [
    Query.limit(pagination?.limit ?? 500),
    Query.offset(pagination?.offset ?? 0),
    Query.orderDesc("$createdAt"),
  ]);
  return res.documents.map((d) => parseDoc(WorkflowSchema, d));
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    return parseDoc(WorkflowSchema,await databases.getDocument(DB_ID, COLLECTIONS.workflows, id));
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
  return parseDoc(WorkflowSchema,doc);
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
  return parseDoc(WorkflowSchema,doc);
}

export async function deleteWorkflow(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.workflows, id);
}

export async function listActiveWorkflowsByTrigger(
  triggerType: string,
  pagination?: { offset?: number; limit?: number },
): Promise<Workflow[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.workflows, [
    Query.equal("status", "active"),
    Query.equal("triggerType", triggerType),
    Query.limit(pagination?.limit ?? 500),
    Query.offset(pagination?.offset ?? 0),
  ]);
  return res.documents.map((d) => parseDoc(WorkflowSchema, d));
}
