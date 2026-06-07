import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Funnel, FunnelStatus } from "@/lib/capture/types";
import { uniqueSlug } from "@/lib/capture/slug";

function fromDoc(doc: Models.Document): Funnel {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    name: rest.name ?? "",
    slug: rest.slug ?? "",
    steps: rest.steps ?? "[]",
    thankYouPageId: rest.thankYouPageId ?? null,
    status: (rest.status ?? "draft") as FunnelStatus,
    views: rest.views ?? 0,
    conversions: rest.conversions ?? 0,
    createdBy: rest.createdBy ?? null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

export async function funnelSlugExists(slug: string): Promise<boolean> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.funnels, [
    Query.equal("slug", slug),
    Query.limit(1),
  ]);
  return res.documents.length > 0;
}

export async function listFunnels(
  pagination?: { offset?: number; limit?: number },
): Promise<Funnel[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.funnels, [
    Query.limit(pagination?.limit ?? 500),
    Query.offset(pagination?.offset ?? 0),
    Query.orderDesc("$createdAt"),
  ]);
  return res.documents.map(fromDoc);
}

export async function getFunnel(id: string): Promise<Funnel | null> {
  try {
    return fromDoc(await databases.getDocument(DB_ID, COLLECTIONS.funnels, id));
  } catch {
    return null;
  }
}

export async function getFunnelBySlug(slug: string): Promise<Funnel | null> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.funnels, [
    Query.equal("slug", slug),
    Query.limit(1),
  ]);
  return res.documents.length ? fromDoc(res.documents[0]) : null;
}

export async function createFunnel(data: {
  name: string;
  steps?: string;
  thankYouPageId?: string | null;
  createdBy?: string | null;
}): Promise<Funnel> {
  const now = new Date().toISOString();
  const slug = await uniqueSlug(data.name, funnelSlugExists);
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.funnels, ID.unique(), {
    name: data.name,
    slug,
    steps: data.steps ?? "[]",
    thankYouPageId: data.thankYouPageId ?? null,
    status: "draft",
    views: 0,
    conversions: 0,
    createdBy: data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return fromDoc(doc);
}

export async function updateFunnel(
  id: string,
  data: Partial<{
    name: string;
    steps: string;
    thankYouPageId: string | null;
    status: FunnelStatus;
  }>,
): Promise<Funnel> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.funnels, id, payload);
  return fromDoc(doc);
}

export async function deleteFunnel(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.funnels, id);
}

export async function incrementFunnelCounter(
  id: string,
  field: "views" | "conversions",
): Promise<void> {
  const funnel = await getFunnel(id);
  if (!funnel) return;
  await databases.updateDocument(DB_ID, COLLECTIONS.funnels, id, {
    [field]: (funnel[field] ?? 0) + 1,
  });
}
