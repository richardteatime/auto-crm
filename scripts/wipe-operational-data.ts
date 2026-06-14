#!/usr/bin/env node
import { config } from "dotenv";
import type { Databases } from "node-appwrite";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const NO_PRESERVE = process.argv.includes("--no-preserve");
const PAGE_SIZE = 500;
const DELETE_CONCURRENCY = 3;
const DELETE_RETRIES = 5;

// Preserve only the canonical internal-team contacts explicitly approved by
// the user. Configuration, users, templates and pipeline stages are not part of
// this script and therefore remain untouched.
const PRESERVED_CONTACT_IDS = NO_PRESERVE
  ? new Set<string>()
  : new Set([
      "6a164d7500184931bb47", // Francesco Mellucci — canonical oldest duplicate
      "6a16d1e40020e04b884d", // Leonardo Sartori
      "6a175927002054196279", // Riccardo Consuegra
    ]);

const OPERATIONAL_COLLECTIONS = [
  "workflow_run_logs",
  "workflow_scheduled",
  "workflow_runs",
  "analytics_events",
  "funnel_events",
  "funnel_sessions",
  "form_submissions",
  "booking_appointments",
  "calendar_events",
  "pipeline_movements",
  "automation_runs",
  "call_tasks",
  "lead_quotes",
  "quotes",
  "workflow_events",
  "chatwoot_messages",
  "orchestrator_runs",
  "deployment_results",
  "project_artifacts",
  "agent_tasks",
  "activities",
  "messages",
  "notifications",
  "tasks",
  "expenses",
  "revenues",
  "opportunities",
  "deals",
  "leads",
  "funnels",
  "booking_links",
  "landing_pages",
  "forms",
  "workflows",
  "project_logs",
  "projects",
] as const;

interface OperationalDocument {
  $id: string;
  [key: string]: unknown;
}

let databases: Databases;
let DB_ID: string;
let Query: typeof import("@/lib/query17").Query;

async function listAllDocuments(
  collection: string,
): Promise<OperationalDocument[]> {
  const documents: OperationalDocument[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await databases.listDocuments(DB_ID, collection, [
      Query.limit(PAGE_SIZE),
      Query.offset(offset),
    ]);
    documents.push(...(page.documents as OperationalDocument[]));
    if (page.documents.length < PAGE_SIZE) break;
  }

  return documents;
}

async function deleteWithRetry(
  collection: string,
  documentId: string,
): Promise<void> {
  for (let attempt = 1; attempt <= DELETE_RETRIES; attempt += 1) {
    try {
      await databases.deleteDocument(DB_ID, collection, documentId);
      return;
    } catch (error) {
      if (attempt === DELETE_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  operation: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await operation(item);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(DELETE_CONCURRENCY, items.length) },
      () => worker(),
    ),
  );
}

function label(document: OperationalDocument): string {
  return String(
    document.name ??
      document.fullName ??
      document.title ??
      document.eventType ??
      document.status ??
      "",
  ).slice(0, 100);
}

async function main() {
  const appwrite = await import("@/lib/appwrite");
  const query = await import("@/lib/query17");
  databases = appwrite.databases;
  DB_ID = appwrite.DB_ID;
  Query = query.Query;

  console.log(
    APPLY
      ? "=== APPLYING OPERATIONAL DATA WIPE ==="
      : "=== OPERATIONAL DATA WIPE DRY-RUN ===",
  );
  console.log(
    `Preserved contact IDs: ${[...PRESERVED_CONTACT_IDS].join(", ")}`,
  );

  const documentsByCollection = new Map<string, OperationalDocument[]>();
  for (const collection of OPERATIONAL_COLLECTIONS) {
    const documents = await listAllDocuments(collection);
    documentsByCollection.set(collection, documents);
    console.log(`${collection}: delete=${documents.length}`);
  }

  const contacts = await listAllDocuments("contacts");
  const preservedContacts = contacts.filter((contact) =>
    PRESERVED_CONTACT_IDS.has(contact.$id),
  );
  const deletedContacts = contacts.filter(
    (contact) => !PRESERVED_CONTACT_IDS.has(contact.$id),
  );

  console.log("\n=== PRESERVED CONTACTS ===");
  for (const contact of preservedContacts) {
    console.log(`  keep ${contact.$id} | ${label(contact)}`);
  }
  if (preservedContacts.length !== PRESERVED_CONTACT_IDS.size && !NO_PRESERVE) {
    throw new Error(
      `Preserve allowlist mismatch: expected ${PRESERVED_CONTACT_IDS.size}, found ${preservedContacts.length}`,
    );
  }

  console.log("\n=== CONTACTS TO DELETE ===");
  for (const contact of deletedContacts) {
    console.log(`  delete ${contact.$id} | ${label(contact)}`);
  }

  const operationalTotal = [...documentsByCollection.values()].reduce(
    (sum, documents) => sum + documents.length,
    0,
  );
  console.log(
    `\nTOTAL: delete ${operationalTotal} operational documents + ${deletedContacts.length} contacts; preserve ${preservedContacts.length} contacts.`,
  );

  if (!APPLY) {
    console.log("\nDry-run completato. Nessun documento cancellato.");
    console.log("Usa --apply per eseguire il wipe operativo.");
    return;
  }

  let deleted = 0;
  for (const collection of OPERATIONAL_COLLECTIONS) {
    const documents = documentsByCollection.get(collection) ?? [];
    if (documents.length === 0) continue;
    await mapWithConcurrency(documents, async (document) => {
      await deleteWithRetry(collection, document.$id);
      deleted += 1;
    });
    console.log(`deleted ${collection}: ${documents.length}`);
  }

  await mapWithConcurrency(deletedContacts, async (contact) => {
    await deleteWithRetry("contacts", contact.$id);
    deleted += 1;
  });
  console.log(`deleted contacts: ${deletedContacts.length}`);
  console.log(`\nWipe completato: ${deleted} documenti rimossi.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
