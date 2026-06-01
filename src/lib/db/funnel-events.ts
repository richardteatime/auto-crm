import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { FunnelEvent, FunnelEventType } from "@/lib/capture/types";
import { withAppwriteRetry } from "@/lib/db/retry";

function fromDoc(doc: Models.Document): FunnelEvent {
  const { $id, $createdAt, ...rest } = doc;
  return {
    id: $id,
    funnelId: rest.funnelId ?? "",
    sessionId: rest.sessionId ?? "",
    stepId: rest.stepId ?? "",
    eventType: (rest.eventType ?? "step_view") as FunnelEventType,
    data: rest.data ?? null,
    createdAt: new Date($createdAt),
  };
}

export async function listFunnelEvents(funnelId: string): Promise<FunnelEvent[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.funnelEvents, [
    Query.equal("funnelId", funnelId),
    Query.limit(2000),
    Query.orderDesc("$createdAt"),
  ]);
  return res.documents.map(fromDoc);
}

export async function createFunnelEvent(data: {
  funnelId: string;
  sessionId: string;
  stepId: string;
  eventType: FunnelEventType;
  data?: Record<string, unknown> | null;
}): Promise<FunnelEvent> {
  const doc = await withAppwriteRetry(() => databases.createDocument(DB_ID, COLLECTIONS.funnelEvents, ID.unique(), {
    funnelId: data.funnelId,
    sessionId: data.sessionId,
    stepId: data.stepId,
    eventType: data.eventType,
    data: data.data ? JSON.stringify(data.data) : null,
    createdAt: new Date().toISOString(),
  }));
  return fromDoc(doc);
}
