import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { FormSubmission } from "@/lib/capture/types";

function fromDoc(doc: Models.Document): FormSubmission {
  const { $id, $createdAt, ...rest } = doc;
  return {
    id: $id,
    formId: rest.formId ?? "",
    landingPageId: rest.landingPageId ?? null,
    funnelId: rest.funnelId ?? null,
    contactId: rest.contactId ?? null,
    data: rest.data ?? "{}",
    ipHash: rest.ipHash ?? null,
    userAgent: rest.userAgent ?? null,
    referrer: rest.referrer ?? null,
    createdAt: new Date($createdAt),
  };
}

export async function listFormSubmissions(
  filters?: {
    formId?: string;
  },
  pagination?: { offset?: number; limit?: number },
): Promise<FormSubmission[]> {
  const queries: string[] = [
    Query.limit(pagination?.limit ?? 500),
    Query.offset(pagination?.offset ?? 0),
    Query.orderDesc("$createdAt"),
  ];
  if (filters?.formId) queries.push(Query.equal("formId", filters.formId));
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.formSubmissions, queries);
  return res.documents.map(fromDoc);
}

export async function createFormSubmission(data: {
  formId: string;
  landingPageId?: string | null;
  funnelId?: string | null;
  contactId?: string | null;
  data: Record<string, unknown>;
  ipHash?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}): Promise<FormSubmission> {
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.formSubmissions, ID.unique(), {
    formId: data.formId,
    landingPageId: data.landingPageId ?? null,
    funnelId: data.funnelId ?? null,
    contactId: data.contactId ?? null,
    data: JSON.stringify(data.data),
    ipHash: data.ipHash ?? null,
    userAgent: data.userAgent ?? null,
    referrer: data.referrer ?? null,
    createdAt: new Date().toISOString(),
  });
  return fromDoc(doc);
}
