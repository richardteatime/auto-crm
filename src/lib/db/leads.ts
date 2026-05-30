import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type {
  Lead,
  LeadCategory,
  LeadPipelineStage,
  LeadStatus,
} from "@/lib/leads/types";

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, createdAt, updatedAt, ...rest } = doc;
  void createdAt;
  void updatedAt;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as T;
}

export interface CreateLeadInput {
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  businessName?: string | null;
  website?: string | null;
  projectType?: string | null;
  category?: LeadCategory;
  source?: string;
  formName?: string | null;
  message?: string | null;
  rawSubject?: string | null;
  rawBody?: string | null;
  customFields?: Record<string, string> | null;
  status?: LeadStatus;
  pipelineStage?: LeadPipelineStage;
  assignedTo?: string | null;
  leadScore?: number;
  contactId?: string | null;
}

export async function listLeads(filters?: {
  pipelineStage?: string;
  status?: string;
  category?: string;
  search?: string;
}): Promise<Lead[]> {
  const queries: string[] = [Query.limit(500), Query.orderDesc("$createdAt")];

  if (filters?.pipelineStage) {
    queries.push(Query.equal("pipelineStage", filters.pipelineStage));
  }
  if (filters?.status) {
    queries.push(Query.equal("status", filters.status));
  }
  if (filters?.category) {
    queries.push(Query.equal("category", filters.category));
  }
  if (filters?.search) {
    queries.push(Query.search("fullName", filters.search));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.leads, queries);
  return res.documents.map((d) => fromDoc<Lead>(d));
}

export async function getLead(id: string): Promise<Lead | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.leads, id);
    return fromDoc<Lead>(doc);
  } catch {
    return null;
  }
}

export async function createLead(data: CreateLeadInput): Promise<Lead> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.leads,
    ID.unique(),
    {
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      fullName: data.fullName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      company: data.company ?? null,
      businessName: data.businessName ?? null,
      website: data.website ?? null,
      projectType: data.projectType ?? null,
      category: data.category ?? "unknown",
      source: data.source ?? "email",
      formName: data.formName ?? null,
      message: data.message ?? null,
      rawSubject: data.rawSubject ?? null,
      rawBody: data.rawBody ?? null,
      customFields: data.customFields ? JSON.stringify(data.customFields) : null,
      status: data.status ?? "new",
      pipelineStage: data.pipelineStage ?? "prospect",
      assignedTo: data.assignedTo ?? null,
      leadScore: data.leadScore ?? 0,
      contactId: data.contactId ?? null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc<Lead>(doc);
}

export async function updateLead(
  id: string,
  data: Partial<{
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    businessName: string | null;
    website: string | null;
    projectType: string | null;
    category: LeadCategory;
    source: string;
    formName: string | null;
    message: string | null;
    rawSubject: string | null;
    rawBody: string | null;
    customFields: Record<string, string> | string | null;
    status: LeadStatus;
    pipelineStage: LeadPipelineStage;
    assignedTo: string | null;
    leadScore: number;
    contactId: string | null;
  }>,
): Promise<Lead> {
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;

  if (
    cleanData.customFields !== undefined &&
    cleanData.customFields !== null &&
    typeof cleanData.customFields !== "string"
  ) {
    cleanData.customFields = JSON.stringify(cleanData.customFields);
  }

  cleanData.updatedAt = new Date().toISOString();

  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.leads,
    id,
    cleanData,
  );
  return fromDoc<Lead>(doc);
}

// ---------------------------------------------------------------------------
// Deduplication — find an existing lead by email, phone, or company
// ---------------------------------------------------------------------------

export async function findDuplicateLead(criteria: {
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}): Promise<Lead | null> {
  const checks: string[][] = [];
  if (criteria.email) checks.push([Query.equal("email", criteria.email)]);
  if (criteria.phone) checks.push([Query.equal("phone", criteria.phone)]);
  if (criteria.company) {
    checks.push([Query.equal("company", criteria.company)]);
  }

  for (const queries of checks) {
    try {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.leads, [
        ...queries,
        Query.limit(1),
      ]);
      if (res.documents.length > 0) {
        return fromDoc<Lead>(res.documents[0]);
      }
    } catch {
      // ignore and try next criterion
    }
  }
  return null;
}
