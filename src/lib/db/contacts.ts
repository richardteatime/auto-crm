import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { Contact, ContactWithDeals } from "@/types";
import { normalizeContactSource } from "./contact-source";
import { parseDoc } from "./parse-doc";
import { ContactSchema, DealSchema, ActivitySchema } from "./schemas";

function isConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  const code = (error as { code?: unknown }).code;
  return (
    msg.includes("duplicate") ||
    msg.includes("already exists") ||
    msg.includes("conflict") ||
    (typeof code === "number" && code === 409)
  );
}

// ---------------------------------------------------------------------------
// listContacts
// ---------------------------------------------------------------------------

export async function listContacts(
  filters?: {
    search?: string;
    temperature?: string;
    source?: string;
  },
  pagination?: { offset?: number; limit?: number },
): Promise<Contact[]> {
  const queries: string[] = [
    Query.limit(pagination?.limit ?? 500),
    Query.offset(pagination?.offset ?? 0),
    Query.orderDesc("$createdAt"),
  ];

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
  return res.documents.map((d) => parseDoc(ContactSchema, d));
}

// ---------------------------------------------------------------------------
// getContact
// ---------------------------------------------------------------------------

export async function getContact(id: string): Promise<Contact | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.contacts, id);
    return parseDoc(ContactSchema, doc);
  } catch {
    return null;
  }
}

export async function findContactByEmailOrPhone(criteria: {
  email?: string | null;
  phone?: string | null;
}): Promise<Contact | null> {
  const checks: string[][] = [];
  if (criteria.email) checks.push([Query.equal("email", criteria.email)]);
  if (criteria.phone) checks.push([Query.equal("phone", criteria.phone)]);

  for (const queries of checks) {
    try {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.contacts, [
        ...queries,
        Query.limit(1),
      ]);
      if (res.documents.length > 0) return parseDoc(ContactSchema, res.documents[0]);
    } catch {
      // Keep trying the remaining identity keys.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// createContact
// ---------------------------------------------------------------------------

export async function createContact(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  vatNumber?: string | null;
  address?: string | null;
  source?: string;
  temperature?: string;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<Contact> {
  const now = new Date().toISOString();
  try {
    const doc = await databases.createDocument(
      DB_ID,
      COLLECTIONS.contacts,
      ID.unique(),
      {
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        company: data.company ?? null,
        vatNumber: data.vatNumber ?? null,
        address: data.address ?? null,
        source: normalizeContactSource(data.source),
        temperature: data.temperature ?? "cold",
        notes: data.notes ?? null,
        createdBy: data.createdBy ?? null,
        createdAt: now,
        updatedAt: now,
      },
    );
    return parseDoc(ContactSchema, doc);
  } catch (error: unknown) {
    if (isConflictError(error)) {
      const existing = await findContactByEmailOrPhone({
        email: data.email,
        phone: data.phone,
      });
      if (existing) return existing;
    }
    throw error;
  }
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
    vatNumber: string | null;
    address: string | null;
    source: string;
    temperature: string;
    notes: string | null;
  }>,
): Promise<Contact> {
  // Filter out undefined values to prevent Appwrite "missing document data" errors
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;

  if (typeof cleanData.source === "string") {
    cleanData.source = normalizeContactSource(cleanData.source);
  }

  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.contacts,
    id,
    cleanData,
  );

  // Sync denormalized contact fields to related deals
  if (data.name !== undefined || data.temperature !== undefined) {
    try {
      const { listDeals, updateDeal } = await import("./deals");
      const deals = await listDeals({ contactId: id });
      for (const deal of deals) {
        await updateDeal(deal.id, {
          contactName: data.name ?? deal.contactName,
          contactTemperature: data.temperature ?? deal.contactTemperature,
        } as unknown as Parameters<typeof updateDeal>[1]);
      }
    } catch {
      // non-blocking: sync failure should not break contact update
    }
  }

  return parseDoc(ContactSchema, doc);
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

  try {
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
      deals: dealsRes.documents.map((d) => parseDoc(DealSchema, d)),
      activities: activitiesRes.documents.map((d) => parseDoc(ActivitySchema, d)),
    };
  } catch {
    // If related collections fail, return contact with empty relations
    return { ...contact, deals: [], activities: [] };
  }
}
