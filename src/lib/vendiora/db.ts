import { ID, type Models } from "node-appwrite";
import { databases, LEADS_DB_ID } from "@/lib/appwrite";
import { Query } from "@/lib/query17";
import {
  mergeSettings,
  isClientStatus,
  isCallStatus,
  type VdPackage,
  type VdClient,
  type VdCall,
  type WaMessage,
  type Conversation,
  type VendioraSettings,
  type BotState,
  type VdOffer,
  type OfferStatus,
  OFFER_STATUSES,
  type ClientOps,
  type VdTask,
  type TaskRole,
  TASK_ROLES,
} from "@/lib/vendiora/types";
import { randomBytes } from "node:crypto";

// Vendiora lives next to the leads (LEADS_DB_ID), so every CRM sharing the leads sees the same data.
export const VD = {
  packages: "vd_packages",
  clients: "vd_clients",
  calls: "vd_calls",
  messages: "vd_messages",
  conversations: "vd_conversations",
  settings: "vd_settings",
  offers: "vd_offers",
  tasks: "vd_tasks",
} as const;

type Doc = Models.Document & Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const n = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const json = <T,>(v: unknown, d: T): T => {
  if (typeof v !== "string" || !v) return d;
  try { return JSON.parse(v) as T; } catch { return d; }
};

async function listAll(col: string, queries: string[] = [], max = 2000): Promise<Doc[]> {
  const out: Doc[] = [];
  let cursor: string | null = null;
  while (out.length < max) {
    const q = [...queries, Query.limit(100)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(LEADS_DB_ID, col, q);
    out.push(...(res.documents as Doc[]));
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return out;
}

function clean(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

// ---------------------------------------------------------------------------
// Settings (single document "main", JSON)
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<VendioraSettings> {
  try {
    const d = (await databases.getDocument(LEADS_DB_ID, VD.settings, "main")) as Doc;
    const base = json<Record<string, unknown>>(d.data, {});
    // The playbook (message texts, team, links) lives in its own TEXT column: "data" is capped at 30k
    const pb = json<Record<string, unknown> | null>(d.playbook, null);
    return mergeSettings(pb ? { ...base, playbook: pb } : base);
  } catch {
    return mergeSettings({});
  }
}

export async function saveSettings(next: VendioraSettings): Promise<VendioraSettings> {
  const { playbook, ...rest } = next;
  const data = JSON.stringify(rest);
  const doc: Record<string, unknown> = { data };
  if (playbook) doc.playbook = JSON.stringify(playbook);
  try {
    await databases.updateDocument(LEADS_DB_ID, VD.settings, "main", doc);
  } catch (e) {
    try {
      await databases.createDocument(LEADS_DB_ID, VD.settings, "main", doc);
    } catch {
      // Schema not migrated yet (no "playbook" column): keep the old behaviour
      if (doc.playbook) { delete doc.playbook; await databases.updateDocument(LEADS_DB_ID, VD.settings, "main", doc).catch(() => { throw e; }); }
      else throw e;
    }
  }
  return mergeSettings(next);
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

function toPackage(d: Doc): VdPackage {
  return {
    id: d.$id,
    name: (d.name as string) || "Pacchetto",
    tagline: s(d.tagline),
    deliverables: s(d.deliverables),
    price: typeof d.price === "number" ? d.price : null,
    vatRate: n(d.vatRate, 22),
    includedCalls: n(d.includedCalls, 0),
    buildDays: n(d.buildDays, 7),
    coachingDays: n(d.coachingDays, 90),
    guarantee: s(d.guarantee),
    paymentTerms: s(d.paymentTerms),
    active: d.active !== false,
    sortOrder: n(d.sortOrder, 0),
    code: s(d.code),
    createdAt: d.$createdAt,
  };
}

export async function listPackages(): Promise<VdPackage[]> {
  const docs = await listAll(VD.packages, [Query.orderAsc("sortOrder")]);
  return docs.map(toPackage);
}

export async function getPackage(id: string): Promise<VdPackage | null> {
  try { return toPackage((await databases.getDocument(LEADS_DB_ID, VD.packages, id)) as Doc); } catch { return null; }
}

export type PackageInput = Omit<VdPackage, "id" | "createdAt">;

export async function createPackage(p: PackageInput): Promise<VdPackage> {
  return toPackage((await databases.createDocument(LEADS_DB_ID, VD.packages, ID.unique(), clean({ ...p }))) as Doc);
}

export async function updatePackage(id: string, p: Partial<PackageInput>): Promise<VdPackage> {
  return toPackage((await databases.updateDocument(LEADS_DB_ID, VD.packages, id, clean({ ...p }))) as Doc);
}

export async function deletePackage(id: string): Promise<void> {
  await databases.deleteDocument(LEADS_DB_ID, VD.packages, id);
}

// ---------------------------------------------------------------------------
// Clients (sold packages)
// ---------------------------------------------------------------------------

const CLIENT_FIELDS = [
  "leadId", "name", "email", "phone", "phoneE164", "taxId", "address", "packageId", "packageSnapshot", "packageName",
  "price", "vatRate", "paymentTerms", "status", "contractNumber", "contractDate", "contractSignedAt", "isPaid", "paidAt",
  "kickoffAt", "storeLiveAt", "storeUrl", "coach", "notes", "autoLog", "packageCode", "stage", "health", "healthScore", "ops",
] as const;

function toClient(d: Doc): VdClient {
  return {
    id: d.$id,
    leadId: s(d.leadId),
    name: (d.name as string) || "Cliente",
    email: s(d.email),
    phone: s(d.phone),
    phoneE164: s(d.phoneE164),
    taxId: s(d.taxId),
    address: s(d.address),
    packageId: s(d.packageId),
    packageSnapshot: s(d.packageSnapshot),
    packageName: (d.packageName as string) || "Pacchetto",
    price: n(d.price),
    vatRate: n(d.vatRate, 22),
    paymentTerms: s(d.paymentTerms),
    status: isClientStatus(d.status) ? d.status : "onboarding",
    contractNumber: (d.contractNumber as string) || "",
    contractDate: (d.contractDate as string) || d.$createdAt,
    contractSignedAt: s(d.contractSignedAt),
    isPaid: d.isPaid === true,
    paidAt: s(d.paidAt),
    kickoffAt: s(d.kickoffAt),
    storeLiveAt: s(d.storeLiveAt),
    storeUrl: s(d.storeUrl),
    coach: s(d.coach),
    notes: s(d.notes),
    autoLog: json<Record<string, string>>(d.autoLog, {}),
    packageCode: s(d.packageCode),
    stage: s(d.stage),
    health: d.health === "verde" || d.health === "giallo" || d.health === "rosso" ? d.health : null,
    healthScore: typeof d.healthScore === "number" ? d.healthScore : null,
    ops: json<ClientOps>(d.ops, {}),
    createdAt: d.$createdAt,
  };
}

export type ClientPatch = Partial<Pick<VdClient, (typeof CLIENT_FIELDS)[number]>>;

function pickClient(p: ClientPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of CLIENT_FIELDS) if (k in p && p[k] !== undefined) out[k] = p[k];
  if (out.autoLog && typeof out.autoLog === "object") out.autoLog = JSON.stringify(out.autoLog).slice(0, 4000);
  if (out.ops && typeof out.ops === "object") out.ops = JSON.stringify(trimOps(out.ops as ClientOps));
  return out;
}

/** Keeps the ops JSON well under the 60k column: oldest history first */
function trimOps(o: ClientOps): ClientOps {
  const c: ClientOps = { ...o };
  if (c.kpi && c.kpi.length > 60) c.kpi = c.kpi.slice(-60);
  if (c.checkins && c.checkins.length > 30) c.checkins = c.checkins.slice(-30);
  if (c.healthHistory && c.healthHistory.length > 40) c.healthHistory = c.healthHistory.slice(-40);
  if (c.referrals && c.referrals.length > 50) c.referrals = c.referrals.slice(-50);
  if (c.sent) {
    const e = Object.entries(c.sent);
    if (e.length > 600) c.sent = Object.fromEntries(e.sort((a, b) => a[1].localeCompare(b[1])).slice(-600));
  }
  return c;
}

/** Read-modify-write of the ops JSON (merge at top level) */
export async function patchClientOps(id: string, patch: Partial<ClientOps>, extra: ClientPatch = {}): Promise<VdClient> {
  const cur = await getClient(id);
  if (!cur) throw new Error("Cliente non trovato");
  return updateClient(id, { ...extra, ops: { ...cur.ops, ...patch } });
}

export async function findClientByPhone(phoneE164: string): Promise<VdClient | null> {
  const res = await databases.listDocuments(LEADS_DB_ID, VD.clients, [Query.equal("phoneE164", phoneE164), Query.orderDesc("$createdAt"), Query.limit(1)]).catch(() => ({ documents: [] as Models.Document[] }));
  return res.documents[0] ? toClient(res.documents[0] as Doc) : null;
}

export async function listClients(): Promise<VdClient[]> {
  return (await listAll(VD.clients, [Query.orderDesc("$createdAt")])).map(toClient);
}

export async function getClient(id: string): Promise<VdClient | null> {
  try { return toClient((await databases.getDocument(LEADS_DB_ID, VD.clients, id)) as Doc); } catch { return null; }
}

export async function findClientByLead(leadId: string): Promise<VdClient | null> {
  const res = await databases.listDocuments(LEADS_DB_ID, VD.clients, [Query.equal("leadId", leadId), Query.limit(1)]);
  return res.documents[0] ? toClient(res.documents[0] as Doc) : null;
}

export async function nextContractNumber(year = new Date().getFullYear()): Promise<string> {
  const res = await databases.listDocuments(LEADS_DB_ID, VD.clients, [
    Query.startsWith("contractNumber", `VO-${year}-`),
    Query.orderDesc("contractNumber"),
    Query.limit(1),
  ]).catch(() => ({ documents: [] as Models.Document[] }));
  const last = (res.documents[0] as Doc | undefined)?.contractNumber as string | undefined;
  const prog = last ? Number(last.split("-")[2]) || 0 : 0;
  return `VO-${year}-${String(prog + 1).padStart(3, "0")}`;
}

export async function createClient(p: ClientPatch & { name: string; contractNumber: string }): Promise<VdClient> {
  return toClient((await databases.createDocument(LEADS_DB_ID, VD.clients, ID.unique(), pickClient(p))) as Doc);
}

export async function updateClient(id: string, p: ClientPatch): Promise<VdClient> {
  return toClient((await databases.updateDocument(LEADS_DB_ID, VD.clients, id, pickClient(p))) as Doc);
}

export async function deleteClient(id: string): Promise<void> {
  for (const c of await listCalls({ clientId: id })) await databases.deleteDocument(LEADS_DB_ID, VD.calls, c.id);
  await databases.deleteDocument(LEADS_DB_ID, VD.clients, id);
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

function toCall(d: Doc): VdCall {
  return {
    id: d.$id,
    clientId: d.clientId as string,
    clientName: (d.clientName as string) || "",
    number: n(d.number, 1),
    title: (d.title as string) || `Call ${n(d.number, 1)}`,
    status: isCallStatus(d.status) ? d.status : "da_prenotare",
    scheduledAt: s(d.scheduledAt),
    doneAt: s(d.doneAt),
    notes: s(d.notes),
    reminderAt: s(d.reminderAt),
    code: s(d.code),
    dueAt: s(d.dueAt),
    summary: s(d.summary),
    homework: s(d.homework),
    homeworkAt: s(d.homeworkAt),
    recordingUrl: s(d.recordingUrl),
    calUid: s(d.calUid),
    meetingUrl: s(d.meetingUrl),
  };
}

export async function listCalls(f: { clientId?: string } = {}): Promise<VdCall[]> {
  const q = [Query.orderAsc("number")];
  if (f.clientId) q.push(Query.equal("clientId", f.clientId));
  return (await listAll(VD.calls, q, 5000)).map(toCall);
}

export async function getCall(id: string): Promise<VdCall | null> {
  try { return toCall((await databases.getDocument(LEADS_DB_ID, VD.calls, id)) as Doc); } catch { return null; }
}

export async function createCall(c: Omit<VdCall, "id" | "reminderAt"> & Partial<Pick<VdCall, "reminderAt">>): Promise<VdCall> {
  return toCall((await databases.createDocument(LEADS_DB_ID, VD.calls, ID.unique(), clean({ ...c }))) as Doc);
}

export async function deleteCall(id: string): Promise<void> {
  await databases.deleteDocument(LEADS_DB_ID, VD.calls, id);
}

export async function updateCall(id: string, p: Partial<Omit<VdCall, "id" | "clientId">>): Promise<VdCall> {
  return toCall((await databases.updateDocument(LEADS_DB_ID, VD.calls, id, clean({ ...p }))) as Doc);
}

// ---------------------------------------------------------------------------
// WhatsApp messages
// ---------------------------------------------------------------------------

function toMessage(d: Doc): WaMessage {
  return {
    id: d.$id,
    leadId: s(d.leadId),
    clientId: s(d.clientId),
    phoneE164: s(d.phoneE164),
    direction: d.direction === "in" ? "in" : "out",
    author: s(d.author),
    text: (d.text as string) || "",
    waId: s(d.waId),
    at: (d.at as string) || d.$createdAt,
  };
}

export async function addMessage(m: Omit<WaMessage, "id">): Promise<WaMessage | null> {
  if (m.waId) {
    const dup = await databases.listDocuments(LEADS_DB_ID, VD.messages, [Query.equal("waId", m.waId), Query.limit(1)]);
    if (dup.documents.length) return null;
  }
  return toMessage((await databases.createDocument(LEADS_DB_ID, VD.messages, ID.unique(), clean({ ...m, text: m.text.slice(0, 4000) }))) as Doc);
}

export async function listMessages(f: { leadId?: string; phoneE164?: string }): Promise<WaMessage[]> {
  const q = [Query.orderAsc("at")];
  if (f.leadId) q.push(Query.equal("leadId", f.leadId));
  else if (f.phoneE164) q.push(Query.equal("phoneE164", f.phoneE164));
  else return [];
  return (await listAll(VD.messages, q, 1000)).map(toMessage);
}

export async function latestMessages(max = 300): Promise<WaMessage[]> {
  const res = await databases.listDocuments(LEADS_DB_ID, VD.messages, [Query.orderDesc("at"), Query.limit(Math.min(max, 100))]);
  return (res.documents as Doc[]).map(toMessage);
}

// ---------------------------------------------------------------------------
// Bot conversations (one per lead)
// ---------------------------------------------------------------------------

function toConversation(d: Doc): Conversation {
  const state = d.state as BotState;
  return {
    id: d.$id,
    leadId: d.leadId as string,
    phoneE164: (d.phoneE164 as string) || "",
    chatIds: json<string[]>(d.chatIds, []),
    state: ["attivo", "in_attesa", "passato", "fermo", "programmato"].includes(state) ? state : "fermo",
    step: n(d.step),
    answers: json<{ q: string; a: string }[]>(d.answers, []),
    lastInboundAt: s(d.lastInboundAt),
    handoffAt: s(d.handoffAt),
    angle: s(d.angle),
    score: typeof d.score === "number" ? d.score : null,
    qual: s(d.qual),
    pkg: s(d.pkg),
    seqLog: json<Record<string, string>>(d.seqLog, {}),
  };
}

export async function getConversationByLead(leadId: string): Promise<Conversation | null> {
  const res = await databases.listDocuments(LEADS_DB_ID, VD.conversations, [Query.equal("leadId", leadId), Query.limit(1)]);
  return res.documents[0] ? toConversation(res.documents[0] as Doc) : null;
}

export async function findConversation(phoneE164: string | null, chatId: string | null): Promise<Conversation | null> {
  if (phoneE164) {
    const res = await databases.listDocuments(LEADS_DB_ID, VD.conversations, [
      Query.equal("phoneE164", phoneE164), Query.orderDesc("$createdAt"), Query.limit(1),
    ]);
    if (res.documents[0]) return toConversation(res.documents[0] as Doc);
  }
  if (chatId) {
    const res = await databases.listDocuments(LEADS_DB_ID, VD.conversations, [
      Query.contains("chatIds", chatId), Query.orderDesc("$createdAt"), Query.limit(1),
    ]).catch(() => ({ documents: [] as Models.Document[] }));
    if (res.documents[0]) return toConversation(res.documents[0] as Doc);
  }
  return null;
}

export async function listConversations(): Promise<Conversation[]> {
  return (await listAll(VD.conversations, [Query.orderDesc("$updatedAt")], 2000)).map(toConversation);
}

export async function saveConversation(c: Omit<Conversation, "id"> & { id?: string }): Promise<Conversation> {
  const data = {
    leadId: c.leadId,
    phoneE164: c.phoneE164,
    chatIds: JSON.stringify([...new Set(c.chatIds)].slice(0, 8)),
    state: c.state,
    step: c.step,
    answers: JSON.stringify(c.answers).slice(0, 8000),
    lastInboundAt: c.lastInboundAt,
    handoffAt: c.handoffAt,
  } as Record<string, unknown>;
  // Playbook fields: written only when present (old rows / old schema keep working)
  if (c.angle !== undefined) data.angle = c.angle;
  if (c.score !== undefined) data.score = c.score;
  if (c.qual !== undefined) data.qual = c.qual;
  if (c.pkg !== undefined) data.pkg = c.pkg;
  if (c.seqLog !== undefined) data.seqLog = JSON.stringify(c.seqLog).slice(0, 4000);
  const doc = c.id
    ? await databases.updateDocument(LEADS_DB_ID, VD.conversations, c.id, data)
    : await databases.createDocument(LEADS_DB_ID, VD.conversations, ID.unique(), data);
  return toConversation(doc as Doc);
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

function toOffer(d: Doc): VdOffer {
  const st = d.status as OfferStatus;
  return {
    id: d.$id,
    number: (d.number as string) || "",
    token: (d.token as string) || "",
    leadId: s(d.leadId),
    clientId: s(d.clientId),
    name: (d.name as string) || "Cliente",
    email: s(d.email),
    phoneE164: s(d.phoneE164),
    packageId: s(d.packageId),
    packageSnapshot: s(d.packageSnapshot),
    packageName: (d.packageName as string) || "Pacchetto",
    price: n(d.price),
    vatRate: n(d.vatRate, 22),
    message: s(d.message),
    status: (OFFER_STATUSES as readonly string[]).includes(st) ? st : "bozza",
    validUntil: s(d.validUntil),
    sentAt: s(d.sentAt),
    viewedAt: s(d.viewedAt),
    answeredAt: s(d.answeredAt),
    followupAt: s(d.followupAt),
    packageCode: s(d.packageCode),
    mode: d.mode === "firma" || d.mode === "proposta" ? d.mode : null,
    taxId: s(d.taxId),
    address: s(d.address),
    signedAt: s(d.signedAt),
    signName: s(d.signName),
    signIp: s(d.signIp),
    signHash: s(d.signHash),
    paymentLink: s(d.paymentLink),
    paidAt: s(d.paidAt),
    contractText: s(d.contractText),
    objection: s(d.objection),
    payPlan: json<VdOffer["payPlan"]>(d.payPlan, null),
    autoLog: json<Record<string, string>>(d.autoLog, {}),
    createdAt: d.$createdAt,
  };
}

function offerDoc(p: OfferPatch): Record<string, unknown> {
  const o = clean({ ...p }) as Record<string, unknown>;
  if (o.autoLog && typeof o.autoLog === "object") o.autoLog = JSON.stringify(o.autoLog).slice(0, 2000);
  if (o.payPlan && typeof o.payPlan === "object") o.payPlan = JSON.stringify(o.payPlan).slice(0, 2000);
  return o;
}

export async function findOffersByClient(clientId: string): Promise<VdOffer[]> {
  const res = await databases.listDocuments(LEADS_DB_ID, VD.offers, [Query.equal("clientId", clientId), Query.orderDesc("$createdAt"), Query.limit(20)]).catch(() => ({ documents: [] as Models.Document[] }));
  return (res.documents as Doc[]).map(toOffer);
}

export type OfferPatch = Partial<Omit<VdOffer, "id" | "createdAt" | "token">>;

export async function listOffers(f: { leadId?: string } = {}): Promise<VdOffer[]> {
  const q = [Query.orderDesc("$createdAt")];
  if (f.leadId) q.push(Query.equal("leadId", f.leadId));
  return (await listAll(VD.offers, q, 3000)).map(toOffer);
}

export async function getOffer(id: string): Promise<VdOffer | null> {
  try { return toOffer((await databases.getDocument(LEADS_DB_ID, VD.offers, id)) as Doc); } catch { return null; }
}

export async function getOfferByToken(token: string): Promise<VdOffer | null> {
  if (!/^[a-f0-9]{32,64}$/.test(token)) return null;
  const res = await databases.listDocuments(LEADS_DB_ID, VD.offers, [Query.equal("token", token), Query.limit(1)]);
  return res.documents[0] ? toOffer(res.documents[0] as Doc) : null;
}

async function nextOfferNumber(year = new Date().getFullYear()): Promise<string> {
  const res = await databases.listDocuments(LEADS_DB_ID, VD.offers, [
    Query.startsWith("number", `OF-${year}-`), Query.orderDesc("number"), Query.limit(1),
  ]).catch(() => ({ documents: [] as Models.Document[] }));
  const last = (res.documents[0] as Doc | undefined)?.number as string | undefined;
  const prog = last ? Number(last.split("-")[2]) || 0 : 0;
  return `OF-${year}-${String(prog + 1).padStart(3, "0")}`;
}

export async function createOffer(o: OfferPatch & { name: string; price: number }): Promise<VdOffer> {
  const number = await nextOfferNumber();
  const token = randomBytes(20).toString("hex");
  return toOffer((await databases.createDocument(LEADS_DB_ID, VD.offers, ID.unique(), offerDoc({ ...o, number, token, status: o.status ?? "bozza" } as OfferPatch))) as Doc);
}

export async function updateOffer(id: string, p: OfferPatch): Promise<VdOffer> {
  return toOffer((await databases.updateDocument(LEADS_DB_ID, VD.offers, id, offerDoc(p))) as Doc);
}

export async function deleteOffer(id: string): Promise<void> {
  await databases.deleteDocument(LEADS_DB_ID, VD.offers, id);
}

// ---------------------------------------------------------------------------
// Team tasks (idempotent by key)
// ---------------------------------------------------------------------------

function toTask(d: Doc): VdTask {
  const role = d.role as TaskRole;
  return {
    id: d.$id,
    key: (d.key as string) || d.$id,
    clientId: s(d.clientId),
    leadId: s(d.leadId),
    title: (d.title as string) || "Attività",
    detail: s(d.detail),
    role: (TASK_ROLES as readonly string[]).includes(role) ? role : "admin",
    dueAt: s(d.dueAt),
    status: d.status === "fatto" ? "fatto" : "aperto",
    doneAt: s(d.doneAt),
    doneBy: s(d.doneBy),
    urgent: d.urgent === true,
    createdAt: d.$createdAt,
  };
}

export async function listTasks(f: { status?: "aperto" | "fatto"; clientId?: string; leadId?: string } = {}): Promise<VdTask[]> {
  const q = [Query.orderDesc("$createdAt")];
  if (f.status) q.push(Query.equal("status", f.status));
  if (f.clientId) q.push(Query.equal("clientId", f.clientId));
  if (f.leadId) q.push(Query.equal("leadId", f.leadId));
  return (await listAll(VD.tasks, q, 3000).catch(() => [] as Doc[])).map(toTask);
}

export async function findTaskByKey(key: string): Promise<VdTask | null> {
  const res = await databases.listDocuments(LEADS_DB_ID, VD.tasks, [Query.equal("key", key.slice(0, 120)), Query.limit(1)]).catch(() => ({ documents: [] as Models.Document[] }));
  return res.documents[0] ? toTask(res.documents[0] as Doc) : null;
}

/** Creates the task once (same key = same task). Returns null when it already existed. */
export async function createTaskOnce(t: Omit<VdTask, "id" | "status" | "doneAt" | "doneBy" | "createdAt">): Promise<VdTask | null> {
  if (await findTaskByKey(t.key)) return null;
  const doc = clean({ ...t, key: t.key.slice(0, 120), title: t.title.slice(0, 300), detail: t.detail?.slice(0, 4000) ?? null, status: "aperto" });
  return toTask((await databases.createDocument(LEADS_DB_ID, VD.tasks, ID.unique(), doc)) as Doc);
}

export async function updateTask(id: string, p: Partial<Pick<VdTask, "status" | "doneAt" | "doneBy" | "dueAt" | "detail" | "title">>): Promise<VdTask> {
  return toTask((await databases.updateDocument(LEADS_DB_ID, VD.tasks, id, clean({ ...p }))) as Doc);
}

export async function deleteTask(id: string): Promise<void> {
  await databases.deleteDocument(LEADS_DB_ID, VD.tasks, id);
}
