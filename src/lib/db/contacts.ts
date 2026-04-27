import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Contact, ContactWithDeals, Deal, Activity } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as T;
}

// ---------------------------------------------------------------------------
// listContacts
// ---------------------------------------------------------------------------

export async function listContacts(filters?: {
  search?: string;
  temperature?: string;
  source?: string;
}): Promise<Contact[]> {
  const queries: string[] = [Query.limit(500), Query.orderDesc("$createdAt")];

  if (filters?.temperature) {
    queries.push(Query.equal("temperature", filters.temperature));
  }
  if (filters?.source) {
    queries.push(Query.equal("source", filters.source));
  }
  if (filters?.search) {
    queries.push(Query.search("name", filters.search));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.contacts, queries);
  return res.documents.map((d) => fromDoc<Contact>(d));
}

// ---------------------------------------------------------------------------
// getContact
// ---------------------------------------------------------------------------

export async function getContact(id: string): Promise<Contact | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.contacts, id);
    return fromDoc<Contact>(doc);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// createContact
// ---------------------------------------------------------------------------

export async function createContact(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string;
  temperature?: string;
  score?: number;
  notes?: string | null;
}): Promise<Contact> {
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.contacts,
    ID.unique(),
    {
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      company: data.company ?? null,
      source: data.source ?? "otro",
      temperature: data.temperature ?? "cold",
      score: data.score ?? 0,
      notes: data.notes ?? null,
    },
  );
  return fromDoc<Contact>(doc);
}

// ---------------------------------------------------------------------------
// updateContact
// ---------------------------------------------------------------------------

export async function updateContact(
  id: string,
  data: Partial<{
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    source: string;
    temperature: string;
    score: number;
    notes: string | null;
  }>,
): Promise<Contact> {
  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.contacts,
    id,
    data as Record<string, unknown>,
  );
  return fromDoc<Contact>(doc);
}

// ---------------------------------------------------------------------------
// deleteContact
// ---------------------------------------------------------------------------

export async function deleteContact(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.contacts, id);
}

// ---------------------------------------------------------------------------
// getContactWithRelations
// ---------------------------------------------------------------------------

export async function getContactWithRelations(
  id: string,
): Promise<ContactWithDeals | null> {
  const contact = await getContact(id);
  if (!contact) return null;

  const [dealsRes, activitiesRes] = await Promise.all([
    databases.listDocuments(DB_ID, COLLECTIONS.deals, [
      Query.equal("contactId", id),
      Query.limit(200),
    ]),
    databases.listDocuments(DB_ID, COLLECTIONS.activities, [
      Query.equal("contactId", id),
      Query.limit(200),
    ]),
  ]);

  return {
    ...contact,
    deals: dealsRes.documents.map((d) => fromDoc<Deal>(d)),
    activities: activitiesRes.documents.map((d) => fromDoc<Activity>(d)),
  };
}
