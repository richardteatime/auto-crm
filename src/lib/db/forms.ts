import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { CrmForm, FormStatus } from "@/lib/capture/types";
import { defaultFormFields, defaultFormStyle } from "@/lib/capture/defaults";

function fromDoc(doc: Models.Document): CrmForm {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    name: rest.name ?? "",
    description: rest.description ?? null,
    fields: rest.fields ?? "[]",
    style: rest.style ?? "{}",
    successMessage: rest.successMessage ?? "Grazie! Ti ricontatteremo presto.",
    redirectUrl: rest.redirectUrl ?? null,
    embedEnabled: rest.embedEnabled ?? true,
    status: (rest.status ?? "draft") as FormStatus,
    views: rest.views ?? 0,
    submissions: rest.submissions ?? 0,
    createdBy: rest.createdBy ?? null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

export async function listForms(
  pagination?: { offset?: number; limit?: number },
): Promise<CrmForm[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.forms, [
    Query.limit(pagination?.limit ?? 500),
    Query.offset(pagination?.offset ?? 0),
    Query.orderDesc("$createdAt"),
  ]);
  return res.documents.map(fromDoc);
}

export async function getForm(id: string): Promise<CrmForm | null> {
  try {
    return fromDoc(await databases.getDocument(DB_ID, COLLECTIONS.forms, id));
  } catch {
    return null;
  }
}

export async function createForm(data: {
  name: string;
  description?: string | null;
  fields?: string;
  style?: string;
  successMessage?: string;
  createdBy?: string | null;
}): Promise<CrmForm> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.forms, ID.unique(), {
    name: data.name,
    description: data.description ?? null,
    fields: data.fields ?? JSON.stringify(defaultFormFields()),
    style: data.style ?? JSON.stringify(defaultFormStyle()),
    successMessage: data.successMessage ?? "Grazie! Ti ricontatteremo presto.",
    redirectUrl: null,
    embedEnabled: true,
    status: "draft",
    views: 0,
    submissions: 0,
    createdBy: data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return fromDoc(doc);
}

export async function updateForm(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    fields: string;
    style: string;
    successMessage: string;
    redirectUrl: string | null;
    embedEnabled: boolean;
    status: FormStatus;
  }>,
): Promise<CrmForm> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.forms, id, payload);
  return fromDoc(doc);
}

export async function deleteForm(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.forms, id);
}

export async function incrementFormCounter(
  id: string,
  field: "views" | "submissions",
): Promise<void> {
  const form = await getForm(id);
  if (!form) return;
  await databases.updateDocument(DB_ID, COLLECTIONS.forms, id, {
    [field]: (form[field] ?? 0) + 1,
  });
}
