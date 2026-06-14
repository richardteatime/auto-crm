#!/usr/bin/env node
import "./load-env";
import { config } from "dotenv";
import { Client, Databases, Query } from "node-appwrite";

config({ path: ".env.source.local" });

const SOURCE_ENDPOINT = process.env.SOURCE_APPWRITE_ENDPOINT || "";
const SOURCE_PROJECT = process.env.SOURCE_APPWRITE_PROJECT_ID || "";
const SOURCE_API_KEY = process.env.SOURCE_APPWRITE_API_KEY || "";
const SOURCE_DB = process.env.SOURCE_APPWRITE_DATABASE_ID || "crm";

const TARGET_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "";
const TARGET_PROJECT = process.env.APPWRITE_PROJECT_ID || "";
const TARGET_API_KEY = process.env.APPWRITE_API_KEY || "";
const TARGET_DB = process.env.APPWRITE_DATABASE_ID || "crm";

const APPLY = process.argv.includes("--apply");
const PAGE_SIZE = 500;

if (!APPLY) {
  console.log("=== DRY-RUN MODE ===");
  console.log("Aggiungi --apply per eseguire la migrazione.\n");
}

const USER_ID_MAP: Record<string, string | null> = {
  "69fe3569001d6868d7e0": "6a162ac9000920902da8", // Francesco
  "69ef7adf0011bc8f0d8d": "6a2dcefde095891b0300", // Leonardo
  "69ef70767bfe83ca7647": "6a2dcc800037d83f4532", // Ricardo
};

function mapUserId(id: string | null | undefined): string | null {
  if (!id) return null;
  return USER_ID_MAP[id] ?? null;
}

function mapUserIdList(value: unknown): string[] | null {
  if (!value) return null;
  let arr: string[];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        arr = JSON.parse(trimmed);
      } catch {
        arr = [trimmed];
      }
    } else {
      arr = [trimmed];
    }
  } else if (Array.isArray(value)) {
    arr = value;
  } else {
    return null;
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.map((id) => (typeof id === "string" ? (mapUserId(id) ?? id) : null)).filter(Boolean) as string[];
}

function normalizeProjectStatus(status: unknown): string {
  const valid = ["aperto", "in_lavorazione", "bloccato", "in_pausa", "revisione_cto", "consegnato"];
  if (typeof status === "string" && valid.includes(status)) return status;
  return "aperto";
}

function normalizeOpportunityStatus(status: unknown): string {
  const valid = ["aperta", "trasformata"];
  if (typeof status === "string" && valid.includes(status)) return status;
  return "aperta";
}

function deriveBillingType(doc: Record<string, unknown>): string {
  if (typeof doc.billingType === "string") return doc.billingType;
  if (doc.isRecurring === true) {
    if (doc.recurringMonths === 12) return "annuale";
    return "mensile";
  }
  return "una_tantum";
}

const sourceClient = new Client()
  .setEndpoint(SOURCE_ENDPOINT)
  .setProject(SOURCE_PROJECT)
  .setKey(SOURCE_API_KEY);
const targetClient = new Client()
  .setEndpoint(TARGET_ENDPOINT)
  .setProject(TARGET_PROJECT)
  .setKey(TARGET_API_KEY);

const sourceDB = new Databases(sourceClient);
const targetDB = new Databases(targetClient);

async function listAll(
  db: typeof sourceDB,
  databaseId: string,
  collectionId: string,
): Promise<Record<string, unknown>[]> {
  const docs: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await db.listDocuments(databaseId, collectionId, [Query.limit(PAGE_SIZE), Query.offset(offset)]);
    docs.push(...(page.documents as Record<string, unknown>[]));
    if (page.documents.length < PAGE_SIZE) break;
  }
  return docs;
}

async function createTarget(
  collectionId: string,
  docId: string,
  data: Record<string, unknown>,
) {
  if (APPLY) {
    await targetDB.createDocument(TARGET_DB, collectionId, docId, data);
  }
}

async function wipeTargetStages() {
  const existing = await listAll(targetDB, TARGET_DB, "pipeline_stages");
  console.log(`pipeline_stages target esistenti: ${existing.length} — verranno rimossi.`);
  if (!APPLY) return;
  for (const stage of existing) {
    await targetDB.deleteDocument(TARGET_DB, "pipeline_stages", String(stage.$id));
  }
}

async function wipeTargetCollection(collectionId: string) {
  const existing = await listAll(targetDB, TARGET_DB, collectionId);
  console.log(`${collectionId} target esistenti: ${existing.length} — verranno rimossi.`);
  if (!APPLY || existing.length === 0) return;
  for (const d of existing) {
    await targetDB.deleteDocument(TARGET_DB, collectionId, String(d.$id));
  }
}

async function migrateContacts() {
  const docs = await listAll(sourceDB, SOURCE_DB, "contacts");
  console.log(`contacts: ${docs.length} da migrare`);
  for (const d of docs) {
    const data: Record<string, unknown> = {
      name: d.name,
      email: d.email ?? null,
      phone: d.phone ?? null,
      company: d.company ?? null,
      vatNumber: d.vatNumber ?? null,
      address: d.address ?? null,
      source: d.source ?? "otro",
      temperature: d.temperature ?? "cold",
      notes: d.notes ?? null,
      createdBy: mapUserId(String(d.createdBy ?? "")),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
    await createTarget("contacts", String(d.$id), data);
  }
}

async function migratePipelineStages() {
  const docs = await listAll(sourceDB, SOURCE_DB, "pipeline_stages");
  console.log(`pipeline_stages: ${docs.length} da migrare`);
  await wipeTargetStages();
  for (const d of docs) {
    const data: Record<string, unknown> = {
      name: d.name,
      order: d.order ?? 1,
      color: d.color ?? "#64748b",
      isWon: d.isWon ?? false,
      isLost: d.isLost ?? false,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
    await createTarget("pipeline_stages", String(d.$id), data);
  }
}

async function migrateDeals() {
  const docs = await listAll(sourceDB, SOURCE_DB, "deals");
  console.log(`deals: ${docs.length} da migrare`);
  for (const d of docs) {
    const data: Record<string, unknown> = {
      title: d.title,
      stageId: d.stageId,
      contactId: d.contactId,
      value: d.value ?? 0,
      probability: d.probability ?? 0,
      expectedClose: d.expectedClose ?? null,
      notes: d.notes ?? null,
      attachments: d.attachments ?? null,
      billingType: deriveBillingType(d),
      recurringMonths: d.recurringMonths ?? null,
      recurringStartDate: d.recurringStartDate ?? null,
      isPaid: d.isPaid ?? false,
      wonAt: d.wonAt ?? null,
      createdBy: mapUserId(String(d.createdBy ?? "")),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
    await createTarget("deals", String(d.$id), data);
  }
}

async function migrateOpportunities() {
  const docs = await listAll(sourceDB, SOURCE_DB, "opportunities");
  console.log(`opportunities: ${docs.length} da migrare`);
  for (const d of docs) {
    const data: Record<string, unknown> = {
      contactId: d.contactId,
      title: d.title,
      description: d.description ?? null,
      notes: d.notes ?? null,
      attachments: d.attachments ?? null,
      value: d.value ?? null,
      status: normalizeOpportunityStatus(d.status),
      dealId: d.dealId ?? null,
      createdBy: mapUserId(String(d.createdBy ?? "")),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
    await createTarget("opportunities", String(d.$id), data);
  }
}

async function migrateProjects() {
  const docs = await listAll(sourceDB, SOURCE_DB, "projects");
  console.log(`projects: ${docs.length} da migrare`);
  for (const d of docs) {
    const assigned = mapUserIdList(d.assignedTo);
    const data: Record<string, unknown> = {
      title: d.title,
      description: d.description ?? null,
      status: normalizeProjectStatus(d.status),
      priority: d.priority ?? "media",
      assignedTo: assigned ? JSON.stringify(assigned) : null,
      notes: d.notes ?? null,
      contactId: d.contactId ?? null,
      dealId: d.dealId ?? null,
      startDate: d.startDate ?? null,
      dueDate: d.dueDate ?? null,
      deliveredAt: d.deliveredAt ?? null,
      createdBy: mapUserId(String(d.createdBy ?? "")),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
    await createTarget("projects", String(d.$id), data);
  }
}

async function migrateQuotes() {
  const docs = await listAll(sourceDB, SOURCE_DB, "quotes");
  console.log(`quotes: ${docs.length} da migrare`);
  for (const d of docs) {
    const data: Record<string, unknown> = {
      dealId: d.dealId,
      number: d.number,
      title: d.title,
      items: d.items ?? "[]",
      notes: d.notes ?? null,
      validUntil: d.validUntil ?? null,
      status: d.status ?? "bozza",
      vatRate: d.vatRate ?? 22,
      createdBy: mapUserId(String(d.createdBy ?? "")),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
    await createTarget("quotes", String(d.$id), data);
  }
}

async function migrateActivities() {
  const docs = await listAll(sourceDB, SOURCE_DB, "activities");
  console.log(`activities: ${docs.length} da migrare`);
  for (const d of docs) {
    const data: Record<string, unknown> = {
      type: d.type,
      description: d.description,
      contactId: d.contactId,
      contactName: d.contactName ?? null,
      dealId: d.dealId ?? null,
      startAt: d.startAt ?? null,
      endAt: d.endAt ?? null,
      scheduledAt: d.scheduledAt ?? null,
      completedAt: d.completedAt ?? null,
      isCompleted: d.isCompleted ?? false,
      notes: d.notes ?? null,
      attachments: d.attachments ?? null,
      assignedTo: mapUserId(String(d.assignedTo ?? "")),
      createdBy: mapUserId(String(d.createdBy ?? "")),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
    await createTarget("activities", String(d.$id), data);
  }
}

async function migrateRevenues() {
  const docs = await listAll(sourceDB, SOURCE_DB, "revenues");
  console.log(`revenues: ${docs.length} da migrare`);
  for (const d of docs) {
    const collected = mapUserIdList(d.collectedBy);
    const data: Record<string, unknown> = {
      description: d.description,
      amount: d.amount ?? 0,
      date: d.date,
      billingType: deriveBillingType(d),
      recurringMonths: d.recurringMonths ?? null,
      startDate: d.startDate ?? null,
      collectedBy: collected ? JSON.stringify(collected) : null,
      isExternal: d.isExternal ?? false,
      notes: d.notes ?? null,
      dealId: d.dealId ?? null,
      opportunityId: d.opportunityId ?? null,
      createdBy: mapUserId(String(d.createdBy ?? "")),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
    await createTarget("revenues", String(d.$id), data);
  }
}

async function migrateCalendarEvents() {
  const docs = await listAll(sourceDB, SOURCE_DB, "calendar_events");
  console.log(`calendar_events: ${docs.length} da migrare`);
  for (const d of docs) {
    const assigned = mapUserIdList(d.assignedTo);
    const data: Record<string, unknown> = {
      title: d.title,
      description: d.description ?? null,
      startAt: d.startAt,
      endAt: d.endAt,
      allDay: d.allDay ?? false,
      type: d.type ?? "activity",
      assignedTo: assigned ? JSON.stringify(assigned) : null,
      createdBy: mapUserId(String(d.createdBy ?? "")),
      contactId: d.contactId ?? null,
      dealId: d.dealId ?? null,
      projectId: d.projectId ?? null,
      location: d.location ?? null,
      color: d.color ?? null,
      isPrivate: d.isPrivate ?? false,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
    await createTarget("calendar_events", String(d.$id), data);
  }
}

async function main() {
  if (!SOURCE_ENDPOINT || !SOURCE_PROJECT || !SOURCE_API_KEY) {
    console.error("Mancano SOURCE_APPWRITE_* in .env.source.local");
    process.exit(1);
  }
  if (!TARGET_ENDPOINT || !TARGET_PROJECT || !TARGET_API_KEY) {
    console.error("Mancano APPWRITE_* in .env.local");
    process.exit(1);
  }

  console.log(`Source: ${SOURCE_ENDPOINT} / ${SOURCE_PROJECT} / ${SOURCE_DB}`);
  console.log(`Target: ${TARGET_ENDPOINT} / ${TARGET_PROJECT} / ${TARGET_DB}\n`);

  await wipeTargetCollection("contacts");
  await migrateContacts();
  await migratePipelineStages();
  await wipeTargetCollection("deals");
  await migrateDeals();
  await wipeTargetCollection("opportunities");
  await migrateOpportunities();
  await wipeTargetCollection("projects");
  await migrateProjects();
  await wipeTargetCollection("quotes");
  await migrateQuotes();
  await wipeTargetCollection("activities");
  await migrateActivities();
  await wipeTargetCollection("revenues");
  await migrateRevenues();
  await wipeTargetCollection("calendar_events");
  await migrateCalendarEvents();

  if (!APPLY) {
    console.log("\nDry-run completato. Nessun documento scritto.");
    console.log("Aggiungi --apply per scrivere i dati nel target.");
  } else {
    console.log("\nMigrazione completata.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
