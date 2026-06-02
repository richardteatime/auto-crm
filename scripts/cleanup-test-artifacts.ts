#!/usr/bin/env node
import { config } from "dotenv";
import type { Databases } from "node-appwrite";

config({ path: ".env.local" });

let databases: Databases;
let DB_ID: string;
let Query: typeof import("@/lib/query17").Query;

const APPLY = process.argv.includes("--apply");
const PAGE_SIZE = 500;
const DELETE_CONCURRENCY = 3;
const DELETE_RETRIES = 5;

// Keep this intentionally strict. The cleanup utility must prefer leaving an
// ambiguous record behind over deleting something that could belong to a real
// prospect. Linked records are discovered separately through ID propagation.
const TEST_MARKER =
  /(\[e2e\]|\be2e\b|test-memory|poc-hermes-test|test-hermes-webhook|@hermes\.com\b|@test\.com\b|qa-source-|mockdeploy\.dev|\btestclient\b)/i;

// System configuration, seeded templates and pipeline stages are deliberately
// excluded. This script cleans operational test artifacts only.
const COLLECTIONS = [
  "contacts",
  "deals",
  "activities",
  "messages",
  "expenses",
  "quotes",
  "notifications",
  "revenues",
  "opportunities",
  "calendar_events",
  "chatwoot_messages",
  "orchestrator_runs",
  "workflow_events",
  "agent_tasks",
  "project_artifacts",
  "deployment_results",
  "tasks",
  "projects",
  "project_logs",
  "leads",
  "pipeline_movements",
  "automation_runs",
  "call_tasks",
  "lead_quotes",
  "landing_pages",
  "forms",
  "form_submissions",
  "booking_links",
  "booking_appointments",
  "funnels",
  "funnel_sessions",
  "funnel_events",
  "analytics_events",
  "workflow_runs",
  "workflow_run_logs",
  "workflow_scheduled",
  "workflows",
] as const;

// Delete children and logs before their parent records. Appwrite does not
// enforce foreign keys here, but this keeps the cleanup safe if constraints are
// introduced later.
const DELETE_ORDER = [
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
  "contacts",
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

interface Artifact {
  collection: string;
  document: OperationalDocument;
  reason: string;
}

function documentKey(collection: string, id: string): string {
  return `${collection}:${id}`;
}

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

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") {
    output.push(value);
    try {
      collectStrings(JSON.parse(value), output);
    } catch {
      // Plain text is expected for most fields.
    }
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, output);
  }

  return output;
}

function artifactLabel(document: OperationalDocument): string {
  const label =
    document.name ??
    document.fullName ??
    document.title ??
    document.email ??
    document.eventType ??
    document.status ??
    "";
  return String(label).slice(0, 100);
}

function classifyArtifacts(
  documentsByCollection: Map<string, OperationalDocument[]>,
): Map<string, Artifact> {
  const artifacts = new Map<string, Artifact>();
  const artifactIds = new Set<string>();

  for (const [collection, documents] of documentsByCollection) {
    for (const document of documents) {
      const hits = collectStrings(document).filter((value) =>
        TEST_MARKER.test(value),
      );
      if (hits.length === 0) continue;

      artifacts.set(documentKey(collection, document.$id), {
        collection,
        document,
        reason: `marker: ${hits.slice(0, 2).join(" | ")}`,
      });
      artifactIds.add(document.$id);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const [collection, documents] of documentsByCollection) {
      for (const document of documents) {
        const key = documentKey(collection, document.$id);
        if (artifacts.has(key)) continue;

        const linkedId = collectStrings(document).find((value) =>
          artifactIds.has(value),
        );
        if (!linkedId) continue;

        artifacts.set(key, {
          collection,
          document,
          reason: `references test artifact ${linkedId}`,
        });
        artifactIds.add(document.$id);
        changed = true;
      }
    }
  }

  return artifacts;
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
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
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
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

async function main() {
  const appwrite = await import("@/lib/appwrite");
  const query = await import("@/lib/query17");
  databases = appwrite.databases;
  DB_ID = appwrite.DB_ID;
  Query = query.Query;

  console.log(
    APPLY
      ? "=== APPLYING APPWRITE TEST ARTIFACT CLEANUP ==="
      : "=== APPWRITE TEST ARTIFACT CLEANUP DRY-RUN ===",
  );

  const documentsByCollection = new Map<string, OperationalDocument[]>();
  for (const collection of COLLECTIONS) {
    try {
      const documents = await listAllDocuments(collection);
      documentsByCollection.set(collection, documents);
      console.log(`scanned ${collection}: ${documents.length}`);
    } catch (error) {
      throw new Error(
        `Unable to scan ${collection}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const artifacts = classifyArtifacts(documentsByCollection);
  console.log("\n=== CLASSIFIED TEST ARTIFACTS ===");
  for (const collection of COLLECTIONS) {
    const matches = [...artifacts.values()].filter(
      (artifact) => artifact.collection === collection,
    );
    console.log(`${collection}: ${matches.length}`);
    for (const artifact of matches.slice(0, 5)) {
      console.log(
        `  - ${artifact.document.$id} | ${artifactLabel(artifact.document)} | ${artifact.reason}`,
      );
    }
    if (matches.length > 5) console.log(`  ... +${matches.length - 5} altri`);
  }
  console.log(`\nTOTAL: ${artifacts.size} artefatti di test classificati`);

  if (!APPLY) {
    console.log("\nDry-run completato. Nessun documento cancellato.");
    console.log("Usa --apply per eseguire la cancellazione mirata.");
    return;
  }

  let deleted = 0;
  console.log("\n=== DELETING CLASSIFIED TEST ARTIFACTS ===");
  for (const collection of DELETE_ORDER) {
    const matches = [...artifacts.values()].filter(
      (artifact) => artifact.collection === collection,
    );
    if (matches.length === 0) continue;

    await mapWithConcurrency(matches, DELETE_CONCURRENCY, async (artifact) => {
      await deleteWithRetry(collection, artifact.document.$id);
      deleted += 1;
    });
    console.log(`deleted ${collection}: ${matches.length}`);
  }

  console.log(`\nCleanup completato: ${deleted}/${artifacts.size} documenti rimossi.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
