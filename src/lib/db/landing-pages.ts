import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { LandingPage, AssetStatus } from "@/lib/capture/types";
import { emptyLandingConfig } from "@/lib/capture/defaults";
import { uniqueSlug } from "@/lib/capture/slug";

function fromDoc(doc: Models.Document): LandingPage {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    name: rest.name ?? "",
    slug: rest.slug ?? "",
    status: (rest.status ?? "draft") as AssetStatus,
    templateId: rest.templateId ?? null,
    config: rest.config ?? "{}",
    metaTitle: rest.metaTitle ?? "",
    metaDescription: rest.metaDescription ?? "",
    faviconUrl: rest.faviconUrl ?? null,
    ogImageUrl: rest.ogImageUrl ?? null,
    views: rest.views ?? 0,
    submissions: rest.submissions ?? 0,
    createdBy: rest.createdBy ?? null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

export async function landingSlugExists(slug: string): Promise<boolean> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.landingPages, [
    Query.equal("slug", slug),
    Query.limit(1),
  ]);
  return res.documents.length > 0;
}

export async function listLandingPages(): Promise<LandingPage[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.landingPages, [
    Query.limit(500),
    Query.orderDesc("$createdAt"),
  ]);
  return res.documents.map(fromDoc);
}

export async function getLandingPage(id: string): Promise<LandingPage | null> {
  try {
    return fromDoc(await databases.getDocument(DB_ID, COLLECTIONS.landingPages, id));
  } catch {
    return null;
  }
}

export async function getLandingPageBySlug(slug: string): Promise<LandingPage | null> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.landingPages, [
    Query.equal("slug", slug),
    Query.limit(1),
  ]);
  return res.documents.length ? fromDoc(res.documents[0]) : null;
}

export interface CreateLandingPageInput {
  name: string;
  config?: string;
  templateId?: string | null;
  metaTitle?: string;
  metaDescription?: string;
  createdBy?: string | null;
}

export async function createLandingPage(data: CreateLandingPageInput): Promise<LandingPage> {
  const now = new Date().toISOString();
  const slug = await uniqueSlug(data.name, landingSlugExists);
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.landingPages, ID.unique(), {
    name: data.name,
    slug,
    status: "draft",
    templateId: data.templateId ?? null,
    config: data.config ?? JSON.stringify(emptyLandingConfig()),
    metaTitle: data.metaTitle ?? data.name,
    metaDescription: data.metaDescription ?? "",
    faviconUrl: null,
    ogImageUrl: null,
    views: 0,
    submissions: 0,
    createdBy: data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return fromDoc(doc);
}

export async function updateLandingPage(
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    status: AssetStatus;
    config: string;
    metaTitle: string;
    metaDescription: string;
    faviconUrl: string | null;
    ogImageUrl: string | null;
  }>,
): Promise<LandingPage> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.landingPages, id, payload);
  return fromDoc(doc);
}

export async function deleteLandingPage(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.landingPages, id);
}

export async function incrementLandingCounter(
  id: string,
  field: "views" | "submissions",
): Promise<void> {
  const page = await getLandingPage(id);
  if (!page) return;
  await databases.updateDocument(DB_ID, COLLECTIONS.landingPages, id, {
    [field]: (page[field] ?? 0) + 1,
  });
}
