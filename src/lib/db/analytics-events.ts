import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type {
  AnalyticsEvent,
  AnalyticsAssetType,
  AnalyticsEventType,
} from "@/lib/capture/types";

function fromDoc(doc: Models.Document): AnalyticsEvent {
  const { $id, $createdAt, ...rest } = doc;
  return {
    id: $id,
    eventType: (rest.eventType ?? "page_view") as AnalyticsEventType,
    assetType: (rest.assetType ?? "landing") as AnalyticsAssetType,
    assetId: rest.assetId ?? "",
    sessionId: rest.sessionId ?? null,
    ipHash: rest.ipHash ?? null,
    userAgent: rest.userAgent ?? null,
    referrer: rest.referrer ?? null,
    createdAt: new Date($createdAt),
  };
}

export async function createAnalyticsEvent(data: {
  eventType: AnalyticsEventType;
  assetType: AnalyticsAssetType;
  assetId: string;
  sessionId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}): Promise<void> {
  await databases.createDocument(DB_ID, COLLECTIONS.analyticsEvents, ID.unique(), {
    eventType: data.eventType,
    assetType: data.assetType,
    assetId: data.assetId,
    sessionId: data.sessionId ?? null,
    ipHash: data.ipHash ?? null,
    userAgent: data.userAgent ?? null,
    referrer: data.referrer ?? null,
    createdAt: new Date().toISOString(),
  });
}

export async function listAnalyticsEvents(filters?: {
  assetType?: AnalyticsAssetType;
  assetId?: string;
  since?: Date | string;
}): Promise<AnalyticsEvent[]> {
  const queries: string[] = [Query.limit(5000), Query.orderDesc("$createdAt")];
  if (filters?.assetType) queries.push(Query.equal("assetType", filters.assetType));
  if (filters?.assetId) queries.push(Query.equal("assetId", filters.assetId));
  if (filters?.since) {
    const iso = filters.since instanceof Date ? filters.since.toISOString() : new Date(filters.since).toISOString();
    queries.push(Query.greaterThanEqual("createdAt", iso));
  }
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.analyticsEvents, queries);
  return res.documents.map(fromDoc);
}
