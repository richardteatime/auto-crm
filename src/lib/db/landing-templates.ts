import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { LandingTemplate, LandingTemplateCategory } from "@/lib/capture/types";

function fromDoc(doc: Models.Document): LandingTemplate {
  const { $id, $createdAt, ...rest } = doc;
  return {
    id: $id,
    name: rest.name ?? "",
    category: (rest.category ?? "blank") as LandingTemplateCategory,
    config: rest.config ?? "{}",
    thumbnailUrl: rest.thumbnailUrl ?? null,
    createdAt: new Date($createdAt),
  };
}

export async function listLandingTemplates(): Promise<LandingTemplate[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.landingTemplates, [
    Query.limit(100),
    Query.orderAsc("name"),
  ]);
  return res.documents.map(fromDoc);
}

export async function getLandingTemplate(id: string): Promise<LandingTemplate | null> {
  try {
    return fromDoc(await databases.getDocument(DB_ID, COLLECTIONS.landingTemplates, id));
  } catch {
    return null;
  }
}

export async function createLandingTemplate(data: {
  name: string;
  category: LandingTemplateCategory;
  config: string;
  thumbnailUrl?: string | null;
}): Promise<LandingTemplate> {
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.landingTemplates, ID.unique(), {
    name: data.name,
    category: data.category,
    config: data.config,
    thumbnailUrl: data.thumbnailUrl ?? null,
    createdAt: new Date().toISOString(),
  });
  return fromDoc(doc);
}
