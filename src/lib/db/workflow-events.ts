import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { WorkflowEvent } from "@/lib/orchestrator/types";

function fromDoc(doc: Models.Document): WorkflowEvent {
  const { $id, $createdAt, ...rest } = doc;
  return {
    id: $id,
    runId: rest.runId as string,
    eventType: rest.eventType as WorkflowEvent["eventType"],
    message: rest.message as string,
    metadata: rest.metadata ? parseMetadata(rest.metadata as string) : null,
    createdAt: new Date($createdAt),
  };
}

function parseMetadata(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function listWorkflowEvents(filters?: {
  runId?: string;
  eventType?: WorkflowEvent["eventType"];
  limit?: number;
}): Promise<WorkflowEvent[]> {
  const queries: string[] = [
    Query.limit(filters?.limit ?? 200),
    Query.orderDesc("$createdAt"),
  ];

  if (filters?.runId) {
    queries.push(Query.equal("runId", filters.runId));
  }
  if (filters?.eventType) {
    queries.push(Query.equal("eventType", filters.eventType));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.workflowEvents, queries);
  return res.documents.map((d) => fromDoc(d));
}

export async function createWorkflowEvent(data: {
  runId?: string | null;
  eventType: WorkflowEvent["eventType"];
  message: string;
  metadata?: Record<string, unknown> | null;
}): Promise<WorkflowEvent> {
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.workflowEvents,
    ID.unique(),
    {
      runId: data.runId ?? null,
      eventType: data.eventType,
      message: data.message,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      createdAt: new Date().toISOString(),
    },
  );
  return fromDoc(doc);
}
