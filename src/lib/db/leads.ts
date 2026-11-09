import { createHash } from "crypto";
import { ID, type Models } from "node-appwrite";
import { databases, LEADS_DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { CRM_INSTANCE_ID, IS_SEPARATE_INSTANCE, LEAD_SOURCE_SCOPE, crmLabel } from "@/lib/instance";
import { Query } from "@/lib/query17";
import { isLeadStatus, type Lead, type LeadEvent, type LeadStatus } from "@/lib/leads/types";

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const LEAD_FIELDS = [
  "externalId", "name", "phone", "phoneE164", "email", "company", "service", "formData", "source",
  "campaign", "adset", "ad", "formName", "platform", "status", "lostReason", "nextActionAt",
  "nextActionNote", "assignedTo", "firstContactAt", "lastContactAt", "callAttempts", "notes", "value",
  "contactId", "dealId", "escalatedAt", "remindedAt", "crmInstance", "dealCrm",
] as const;

// ---------------------------------------------------------------------------
// Scope: a separate CRM instance only sees the lead sources it is meant for
// (e.g. Meta Ads) plus the leads entered by hand in that instance.
// ---------------------------------------------------------------------------

export function leadInScope(lead: Pick<Lead, "source" | "crmInstance">): boolean {
  if (!IS_SEPARATE_INSTANCE) return true;
  if (lead.crmInstance && lead.crmInstance === CRM_INSTANCE_ID) return true;
  return LEAD_SOURCE_SCOPE.length === 0 || LEAD_SOURCE_SCOPE.includes(lead.source);
}

function toLead(doc: Models.Document): Lead {
  const d = doc as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { id: doc.$id, createdAt: doc.$createdAt, updatedAt: doc.$updatedAt };
  for (const k of LEAD_FIELDS) out[k] = d[k] ?? null;
  out.status = isLeadStatus(d.status) ? d.status : "nuovo";
  out.callAttempts = typeof d.callAttempts === "number" ? d.callAttempts : 0;
  out.source = (d.source as string) || "meta_form";
  out.name = (d.name as string) || "Senza nome";
  // Converted in another CRM instance: the deal is not in this database
  const dealCrm = ((d.dealCrm as string) || "").trim();
  out.dealElsewhere = d.dealId && dealCrm !== CRM_INSTANCE_ID ? crmLabel(dealCrm) : null;
  return out as unknown as Lead;
}

function toEvent(doc: Models.Document): LeadEvent {
  const d = doc as unknown as Record<string, unknown>;
  return {
    id: doc.$id,
    leadId: d.leadId as string,
    type: d.type as LeadEvent["type"],
    outcome: (d.outcome as string) ?? null,
    fromStatus: (d.fromStatus as string) ?? null,
    toStatus: (d.toStatus as string) ?? null,
    note: (d.note as string) ?? null,
    actorId: (d.actorId as string) ?? null,
    actorName: (d.actorName as string) ?? null,
    createdAt: doc.$createdAt,
  };
}

/** Appwrite rejects undefined; strings get trimmed to the attribute size */
const LIMITS: Partial<Record<(typeof LEAD_FIELDS)[number], number>> = {
  externalId: 128, name: 255, phone: 64, phoneE164: 32, email: 255, company: 255, service: 255,
  formData: 16384, source: 32, campaign: 255, adset: 255, ad: 255, formName: 255, platform: 32,
  status: 32, lostReason: 255, nextActionNote: 1024, assignedTo: 64, notes: 8192, contactId: 64, dealId: 64,
  crmInstance: 32, dealCrm: 32,
};

function clean(patch: Partial<Record<(typeof LEAD_FIELDS)[number], unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const max = LIMITS[k as keyof typeof LIMITS];
    out[k] = typeof v === "string" && max ? v.slice(0, max) : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function listLeads(filters?: { statuses?: LeadStatus[]; max?: number }): Promise<Lead[]> {
  const max = filters?.max ?? 2000;
  const out: Lead[] = [];
  let cursor: string | null = null;
  while (out.length < max) {
    const queries = [Query.limit(100), Query.orderDesc("$createdAt")];
    if (filters?.statuses?.length) queries.push(Query.equal("status", filters.statuses));
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(LEADS_DB_ID, COLLECTIONS.leads, queries);
    out.push(...res.documents.map(toLead).filter(leadInScope));
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return out;
}

export async function getLead(id: string): Promise<Lead | null> {
  try {
    const lead = toLead(await databases.getDocument(LEADS_DB_ID, COLLECTIONS.leads, id));
    return leadInScope(lead) ? lead : null;
  } catch {
    return null;
  }
}

export async function findLeadByExternalId(externalId: string): Promise<Lead | null> {
  const res = await databases.listDocuments(LEADS_DB_ID, COLLECTIONS.leads, [
    Query.equal("externalId", externalId),
    Query.limit(1),
  ]);
  return res.documents[0] ? toLead(res.documents[0]) : null;
}

/** Other open leads with the same phone (same person filling twice) */
export async function findLeadsByPhone(phoneE164: string): Promise<Lead[]> {
  const res = await databases.listDocuments(LEADS_DB_ID, COLLECTIONS.leads, [
    Query.equal("phoneE164", phoneE164),
    Query.limit(10),
  ]);
  return res.documents.map(toLead).filter(leadInScope);
}

export type NewLead = Partial<Omit<Lead, "id" | "createdAt" | "updatedAt">> & { externalId: string; name: string };

/** Idempotent on externalId: a retried webhook returns the existing lead */
export async function createLead(data: NewLead): Promise<{ lead: Lead; duplicate: boolean }> {
  const existing = await findLeadByExternalId(data.externalId);
  if (existing) return { lead: existing, duplicate: true };
  try {
    const doc = await databases.createDocument(
      LEADS_DB_ID,
      COLLECTIONS.leads,
      ID.unique(),
      clean({ status: "nuovo", callAttempts: 0, ...(CRM_INSTANCE_ID ? { crmInstance: CRM_INSTANCE_ID } : {}), ...data })
    );
    return { lead: toLead(doc), duplicate: false };
  } catch (e) {
    // Unique index race: two retries landed together
    if (e instanceof Error && /already exists|Duplicate|409/i.test(e.message)) {
      const again = await findLeadByExternalId(data.externalId);
      if (again) return { lead: again, duplicate: true };
    }
    throw e;
  }
}

export async function updateLead(id: string, patch: Partial<Omit<Lead, "id" | "createdAt" | "updatedAt">>): Promise<Lead> {
  const doc = await databases.updateDocument(LEADS_DB_ID, COLLECTIONS.leads, id, clean(patch));
  return toLead(doc);
}

/** A deal of THIS instance was deleted: leads converted into it go back to unconverted */
export async function unlinkLeadsFromDeal(dealId: string): Promise<void> {
  const res = await databases.listDocuments(LEADS_DB_ID, COLLECTIONS.leads, [
    Query.equal("dealId", dealId),
    Query.limit(100),
  ]);
  for (const doc of res.documents) {
    const dealCrm = (((doc as unknown as Record<string, unknown>).dealCrm as string) || "").trim();
    if (dealCrm !== CRM_INSTANCE_ID) continue; // same id in another CRM's database
    await databases.updateDocument(LEADS_DB_ID, COLLECTIONS.leads, doc.$id, { dealId: null }).catch(() => undefined);
  }
}

export async function deleteLead(id: string): Promise<void> {
  await databases.deleteDocument(LEADS_DB_ID, COLLECTIONS.leads, id);
  const events = await databases.listDocuments(LEADS_DB_ID, COLLECTIONS.leadEvents, [
    Query.equal("leadId", id),
    Query.limit(500),
  ]);
  await Promise.all(events.documents.map((e) => databases.deleteDocument(LEADS_DB_ID, COLLECTIONS.leadEvents, e.$id)));
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export async function listLeadEvents(leadId: string): Promise<LeadEvent[]> {
  const res = await databases.listDocuments(LEADS_DB_ID, COLLECTIONS.leadEvents, [
    Query.equal("leadId", leadId),
    Query.orderDesc("$createdAt"),
    Query.limit(200),
  ]);
  return res.documents.map(toEvent);
}

export async function addLeadEvent(e: Omit<LeadEvent, "id" | "createdAt">): Promise<LeadEvent> {
  const doc = await databases.createDocument(LEADS_DB_ID, COLLECTIONS.leadEvents, ID.unique(), {
    leadId: e.leadId,
    type: e.type,
    outcome: e.outcome ?? null,
    fromStatus: e.fromStatus ?? null,
    toStatus: e.toStatus ?? null,
    note: e.note ? e.note.slice(0, 4096) : null,
    actorId: e.actorId ?? null,
    actorName: e.actorName ? e.actorName.slice(0, 128) : null,
  });
  return toEvent(doc);
}

// ---------------------------------------------------------------------------
// Web push subscriptions
// ---------------------------------------------------------------------------

export interface PushSubscriptionRow {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const endpointHash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

export async function savePushSubscription(s: Omit<PushSubscriptionRow, "id"> & { userAgent?: string | null }) {
  const hash = endpointHash(s.endpoint);
  const found = await databases.listDocuments(LEADS_DB_ID, COLLECTIONS.pushSubscriptions, [
    Query.equal("endpointHash", hash),
    Query.limit(1),
  ]);
  const data = {
    userId: s.userId,
    endpointHash: hash,
    endpoint: s.endpoint,
    p256dh: s.p256dh,
    auth: s.auth,
    userAgent: (s.userAgent ?? "").slice(0, 255) || null,
  };
  if (found.documents[0]) {
    await databases.updateDocument(LEADS_DB_ID, COLLECTIONS.pushSubscriptions, found.documents[0].$id, data);
  } else {
    await databases.createDocument(LEADS_DB_ID, COLLECTIONS.pushSubscriptions, ID.unique(), data);
  }
}

export async function deletePushSubscription(endpoint: string) {
  const found = await databases.listDocuments(LEADS_DB_ID, COLLECTIONS.pushSubscriptions, [
    Query.equal("endpointHash", endpointHash(endpoint)),
    Query.limit(5),
  ]);
  await Promise.all(found.documents.map((d) => databases.deleteDocument(LEADS_DB_ID, COLLECTIONS.pushSubscriptions, d.$id)));
}

export async function deletePushSubscriptionById(id: string) {
  await databases.deleteDocument(LEADS_DB_ID, COLLECTIONS.pushSubscriptions, id).catch(() => {});
}

export async function listPushSubscriptions(userIds?: string[]): Promise<PushSubscriptionRow[]> {
  const queries = [Query.limit(200)];
  if (userIds?.length) queries.push(Query.equal("userId", userIds));
  const res = await databases.listDocuments(LEADS_DB_ID, COLLECTIONS.pushSubscriptions, queries);
  return res.documents.map((d) => {
    const r = d as unknown as Record<string, string>;
    return { id: d.$id, userId: r.userId, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth };
  });
}

export async function countPushSubscriptions(userId: string): Promise<number> {
  const res = await databases.listDocuments(LEADS_DB_ID, COLLECTIONS.pushSubscriptions, [
    Query.equal("userId", userId),
    Query.limit(1),
  ]);
  return res.total;
}
