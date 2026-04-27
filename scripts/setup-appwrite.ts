import { Client, Databases, ID, Query, DatabasesIndexType } from "node-appwrite";
import "dotenv/config";

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

async function main() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const db = new Databases(client);

  console.log(`Using database: ${DB_ID}`);
  console.log(`Endpoint: ${APPWRITE_ENDPOINT}`);

  // Helper to create collection
  async function ensureCollection(collectionId: string, name: string) {
    try {
      await db.createCollection(DB_ID, collectionId, name);
      console.log(`  Collection "${collectionId}" created`);
    } catch (e: unknown) {
      if (e instanceof Error && (e.message.includes("already exists") || e.message.includes("Duplicate"))) {
        console.log(`  Collection "${collectionId}" already exists`);
      } else {
        throw e;
      }
    }
  }

  // Helper to create attribute (ignore if exists)
  async function addAttr(collectionId: string, factory: () => Promise<unknown>) {
    try {
      await factory();
    } catch (e: unknown) {
      if (e instanceof Error && (e.message.includes("already exists") || e.message.includes("Duplicate"))) {
        // Attribute exists, skip
      } else {
        console.error(`    Error in ${collectionId}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  // Helper to create index (ignore if exists)
  async function addIndex(collectionId: string, key: string, type: DatabasesIndexType, attrs: string[]) {
    try {
      await db.createIndex(DB_ID, collectionId, key, type, attrs);
      console.log(`    Index "${key}" created`);
    } catch (e: unknown) {
      if (e instanceof Error && (e.message.includes("already exists") || e.message.includes("Duplicate"))) {
        // Index exists, skip
      } else {
        console.error(`    Index error in ${collectionId}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  // Shorthand helpers matching old column API
  const str = (col: string, key: string, size: number, req: boolean, def?: string) =>
    () => db.createStringAttribute(DB_ID, col, key, size, req, def);
  const email = (col: string, key: string, req: boolean) =>
    () => db.createEmailAttribute(DB_ID, col, key, req);
  const text = (col: string, key: string, req: boolean) =>
    () => db.createStringAttribute(DB_ID, col, key, 16384, req);
  const int = (col: string, key: string, req: boolean, def?: number, min?: number, max?: number) =>
    () => db.createIntegerAttribute(DB_ID, col, key, req, min, max, def);
  const bool = (col: string, key: string, req: boolean, def?: boolean) =>
    () => db.createBooleanAttribute(DB_ID, col, key, req, def);
  const dt = (col: string, key: string, req: boolean) =>
    () => db.createDatetimeAttribute(DB_ID, col, key, req);
  const enm = (col: string, key: string, elements: string[], req: boolean, def?: string) =>
    () => db.createEnumAttribute(DB_ID, col, key, elements, req, def);

  console.log("\n--- Creating Collections ---\n");

  // === CONTACTS ===
  await ensureCollection("contacts", "Contacts");
  await addAttr("contacts", str("contacts", "name", 255, true));
  await addAttr("contacts", email("contacts", "email", false));
  await addAttr("contacts", str("contacts", "phone", 50, false));
  await addAttr("contacts", str("contacts", "company", 255, false));
  await addAttr("contacts", enm("contacts", "source", ["website", "whatsapp", "referido", "redes_sociales", "llamada_fria", "email", "formulario", "evento", "import", "webhook", "otro"], true, "otro"));
  await addAttr("contacts", enm("contacts", "temperature", ["cold", "warm", "hot"], true, "cold"));
  await addAttr("contacts", int("contacts", "score", true, 0, 0, 100));
  await addAttr("contacts", text("contacts", "notes", false));
  await addAttr("contacts", dt("contacts", "createdAt", true));
  await addAttr("contacts", dt("contacts", "updatedAt", true));
  await addIndex("contacts", "idx_temperature", DatabasesIndexType.Key, ["temperature"]);
  await addIndex("contacts", "idx_source", DatabasesIndexType.Key, ["source"]);
  await addIndex("contacts", "idx_createdAt", DatabasesIndexType.Key, ["createdAt"]);

  // === PIPELINE STAGES ===
  await ensureCollection("pipeline_stages", "Pipeline Stages");
  await addAttr("pipeline_stages", str("pipeline_stages", "name", 128, true));
  await addAttr("pipeline_stages", int("pipeline_stages", "order", true, 1));
  await addAttr("pipeline_stages", str("pipeline_stages", "color", 7, true, "#64748b"));
  await addAttr("pipeline_stages", bool("pipeline_stages", "isWon", true, false));
  await addAttr("pipeline_stages", bool("pipeline_stages", "isLost", true, false));
  await addIndex("pipeline_stages", "idx_order", DatabasesIndexType.Key, ["order"]);

  // === DEALS ===
  await ensureCollection("deals", "Deals");
  await addAttr("deals", str("deals", "title", 255, true));
  await addAttr("deals", int("deals", "value", true, 0));
  await addAttr("deals", str("deals", "stageId", 128, true));
  await addAttr("deals", str("deals", "contactId", 128, true));
  await addAttr("deals", str("deals", "contactName", 255, false));
  await addAttr("deals", enm("deals", "contactTemperature", ["cold", "warm", "hot"], false));
  await addAttr("deals", str("deals", "stageName", 128, false));
  await addAttr("deals", str("deals", "stageColor", 7, false));
  await addAttr("deals", dt("deals", "expectedClose", false));
  await addAttr("deals", int("deals", "probability", true, 0, 0, 100));
  await addAttr("deals", text("deals", "notes", false));
  await addAttr("deals", text("deals", "attachments", false));
  await addAttr("deals", bool("deals", "isRecurring", true, false));
  await addAttr("deals", int("deals", "recurringMonths", false, 12));
  await addAttr("deals", dt("deals", "recurringStartDate", false));
  await addAttr("deals", dt("deals", "wonAt", false));
  await addAttr("deals", dt("deals", "createdAt", true));
  await addAttr("deals", dt("deals", "updatedAt", true));
  await addIndex("deals", "idx_stageId", DatabasesIndexType.Key, ["stageId"]);
  await addIndex("deals", "idx_contactId", DatabasesIndexType.Key, ["contactId"]);
  await addIndex("deals", "idx_createdAt", DatabasesIndexType.Key, ["createdAt"]);

  // === ACTIVITIES ===
  await ensureCollection("activities", "Activities");
  await addAttr("activities", enm("activities", "type", ["call", "email", "meeting", "note", "follow_up"], true));
  await addAttr("activities", text("activities", "description", true));
  await addAttr("activities", str("activities", "contactId", 128, true));
  await addAttr("activities", str("activities", "contactName", 255, false));
  await addAttr("activities", str("activities", "dealId", 128, false));
  await addAttr("activities", dt("activities", "startAt", false));
  await addAttr("activities", dt("activities", "endAt", false));
  await addAttr("activities", text("activities", "notes", false));
  await addAttr("activities", text("activities", "attachments", false));
  await addAttr("activities", dt("activities", "scheduledAt", false));
  await addAttr("activities", dt("activities", "completedAt", false));
  await addAttr("activities", bool("activities", "isCompleted", true, false));
  await addAttr("activities", dt("activities", "createdAt", true));
  await addIndex("activities", "idx_contactId", DatabasesIndexType.Key, ["contactId"]);
  await addIndex("activities", "idx_dealId", DatabasesIndexType.Key, ["dealId"]);
  await addIndex("activities", "idx_isCompleted", DatabasesIndexType.Key, ["isCompleted"]);
  await addIndex("activities", "idx_scheduledAt", DatabasesIndexType.Key, ["scheduledAt"]);

  // === CRM SETTINGS ===
  await ensureCollection("crm_settings", "CRM Settings");
  await addAttr("crm_settings", str("crm_settings", "key", 128, true));
  await addAttr("crm_settings", text("crm_settings", "value", true));
  await addIndex("crm_settings", "idx_key_unique", DatabasesIndexType.Unique, ["key"]);

  // === TASKS ===
  await ensureCollection("tasks", "Tasks");
  await addAttr("tasks", str("tasks", "title", 255, true));
  await addAttr("tasks", text("tasks", "description", false));
  await addAttr("tasks", str("tasks", "assignedTo", 255, true));
  await addAttr("tasks", str("tasks", "createdBy", 255, true));
  await addAttr("tasks", bool("tasks", "done", true, false));
  await addAttr("tasks", dt("tasks", "dueAt", false));
  await addAttr("tasks", dt("tasks", "createdAt", true));
  await addAttr("tasks", dt("tasks", "updatedAt", true));

  // === MESSAGES ===
  await ensureCollection("messages", "Messages");
  await addAttr("messages", str("messages", "author", 255, true));
  await addAttr("messages", text("messages", "content", true));
  await addAttr("messages", dt("messages", "createdAt", true));

  // === EXPENSES ===
  await ensureCollection("expenses", "Expenses");
  await addAttr("expenses", enm("expenses", "type", ["spesa", "investimento", "stipendio"], true, "spesa"));
  await addAttr("expenses", str("expenses", "category", 128, true, "Altro"));
  await addAttr("expenses", text("expenses", "description", true));
  await addAttr("expenses", int("expenses", "amount", true));
  await addAttr("expenses", dt("expenses", "date", true));
  await addAttr("expenses", str("expenses", "createdBy", 255, true, "Team"));
  await addAttr("expenses", dt("expenses", "createdAt", true));
  await addAttr("expenses", dt("expenses", "updatedAt", true));
  await addIndex("expenses", "idx_date", DatabasesIndexType.Key, ["date"]);

  // === QUOTES ===
  await ensureCollection("quotes", "Quotes");
  await addAttr("quotes", str("quotes", "dealId", 128, true));
  await addAttr("quotes", str("quotes", "number", 64, true));
  await addAttr("quotes", str("quotes", "title", 255, true));
  await addAttr("quotes", text("quotes", "items", true));
  await addAttr("quotes", text("quotes", "notes", false));
  await addAttr("quotes", enm("quotes", "status", ["bozza", "inviato", "accettato", "rifiutato"], true, "bozza"));
  await addAttr("quotes", int("quotes", "vatRate", true, 22));
  await addAttr("quotes", dt("quotes", "validUntil", false));
  await addAttr("quotes", dt("quotes", "createdAt", true));
  await addAttr("quotes", dt("quotes", "updatedAt", true));
  await addIndex("quotes", "idx_dealId", DatabasesIndexType.Key, ["dealId"]);

  // Seed default pipeline stages
  console.log("\n--- Seeding Pipeline Stages ---\n");
  const { total } = await db.listDocuments(DB_ID, "pipeline_stages", [Query.limit(1)]);
  if (total === 0) {
    const defaultStages = [
      { name: "Prospetto", order: 1, color: "#64748b", isWon: false, isLost: false },
      { name: "Contattato", order: 2, color: "#2563eb", isWon: false, isLost: false },
      { name: "Proposta", order: 3, color: "#8b5cf6", isWon: false, isLost: false },
      { name: "Negoziazione", order: 4, color: "#ea580c", isWon: false, isLost: false },
      { name: "Chiuso Vinto", order: 5, color: "#16a34a", isWon: true, isLost: false },
      { name: "Chiuso Perso", order: 6, color: "#dc2626", isWon: false, isLost: true },
    ];

    for (const stage of defaultStages) {
      await db.createDocument(DB_ID, "pipeline_stages", ID.unique(), stage);
      console.log(`  Stage "${stage.name}" created`);
    }
  } else {
    console.log("  Pipeline stages already exist, skipping seed");
  }

  console.log("\nSetup complete!");
}

main().catch((e) => {
  console.error("Setup failed:", e);
  process.exit(1);
});
