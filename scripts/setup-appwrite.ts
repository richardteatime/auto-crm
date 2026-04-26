import { Client, TablesDB, Databases, ID, Query, TablesDBIndexType } from "node-appwrite";
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

  const tables = new TablesDB(client);
  const databases = new Databases(client);

  // Create database
  try {
    await tables.create(DB_ID, "CRM Database");
    console.log(`Database "${DB_ID}" created`);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("already exists")) {
      console.log(`Database "${DB_ID}" already exists`);
    } else {
      throw e;
    }
  }

  // Helper to create table
  async function ensureTable(tableId: string, name: string) {
    try {
      await tables.createTable(DB_ID, tableId, name);
      console.log(`  Table "${tableId}" created`);
    } catch (e: unknown) {
      if (e instanceof Error && (e.message.includes("already exists") || e.message.includes("Duplicate"))) {
        console.log(`  Table "${tableId}" already exists`);
      } else {
        throw e;
      }
    }
  }

  // Helper to create column (ignore if exists)
  async function addColumn(tableId: string, factory: () => Promise<unknown>) {
    try {
      await factory();
    } catch (e: unknown) {
      if (e instanceof Error && (e.message.includes("already exists") || e.message.includes("Duplicate"))) {
        // Column exists, skip
      } else {
        console.error(`    Error creating column in ${tableId}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  // Helper to create index (ignore if exists)
  async function addIndex(tableId: string, key: string, type: string, columns: string[]) {
    try {
      await tables.createIndex(DB_ID, tableId, key, type.toLowerCase() as TablesDBIndexType, columns);
      console.log(`    Index "${key}" created`);
    } catch (e: unknown) {
      if (e instanceof Error && (e.message.includes("already exists") || e.message.includes("Duplicate"))) {
        // Index exists, skip
      }
    }
  }

  console.log("\n--- Creating Tables ---\n");

  // === CONTACTS ===
  await ensureTable("contacts", "Contacts");
  await addColumn("contacts", () => tables.createStringColumn(DB_ID, "contacts", "name", 255, true));
  await addColumn("contacts", () => tables.createEmailColumn(DB_ID, "contacts", "email", false));
  await addColumn("contacts", () => tables.createStringColumn(DB_ID, "contacts", "phone", 50, false));
  await addColumn("contacts", () => tables.createStringColumn(DB_ID, "contacts", "company", 255, false));
  await addColumn("contacts", () => tables.createEnumColumn(DB_ID, "contacts", "source", ["website", "whatsapp", "referido", "redes_sociales", "llamada_fria", "email", "formulario", "evento", "import", "webhook", "otro"], true, "otro"));
  await addColumn("contacts", () => tables.createEnumColumn(DB_ID, "contacts", "temperature", ["cold", "warm", "hot"], true, "cold"));
  await addColumn("contacts", () => tables.createIntegerColumn(DB_ID, "contacts", "score", true, 0, 0, 100));
  await addColumn("contacts", () => tables.createTextColumn(DB_ID, "contacts", "notes", false));
  await addColumn("contacts", () => tables.createDatetimeColumn(DB_ID, "contacts", "createdAt", true));
  await addColumn("contacts", () => tables.createDatetimeColumn(DB_ID, "contacts", "updatedAt", true));
  await addIndex("contacts", "idx_temperature", "KEY", ["temperature"]);
  await addIndex("contacts", "idx_source", "KEY", ["source"]);
  await addIndex("contacts", "idx_createdAt", "KEY", ["createdAt"]);

  // === PIPELINE STAGES ===
  await ensureTable("pipeline_stages", "Pipeline Stages");
  await addColumn("pipeline_stages", () => tables.createStringColumn(DB_ID, "pipeline_stages", "name", 128, true));
  await addColumn("pipeline_stages", () => tables.createIntegerColumn(DB_ID, "pipeline_stages", "order", true, 1));
  await addColumn("pipeline_stages", () => tables.createStringColumn(DB_ID, "pipeline_stages", "color", 7, true, "#64748b"));
  await addColumn("pipeline_stages", () => tables.createBooleanColumn(DB_ID, "pipeline_stages", "isWon", true, false));
  await addColumn("pipeline_stages", () => tables.createBooleanColumn(DB_ID, "pipeline_stages", "isLost", true, false));
  await addIndex("pipeline_stages", "idx_order", "KEY", ["order"]);

  // === DEALS ===
  await ensureTable("deals", "Deals");
  await addColumn("deals", () => tables.createStringColumn(DB_ID, "deals", "title", 255, true));
  await addColumn("deals", () => tables.createIntegerColumn(DB_ID, "deals", "value", true, 0));
  await addColumn("deals", () => tables.createStringColumn(DB_ID, "deals", "stageId", 128, true));
  await addColumn("deals", () => tables.createStringColumn(DB_ID, "deals", "contactId", 128, true));
  await addColumn("deals", () => tables.createStringColumn(DB_ID, "deals", "contactName", 255, false));
  await addColumn("deals", () => tables.createEnumColumn(DB_ID, "deals", "contactTemperature", ["cold", "warm", "hot"], false));
  await addColumn("deals", () => tables.createStringColumn(DB_ID, "deals", "stageName", 128, false));
  await addColumn("deals", () => tables.createStringColumn(DB_ID, "deals", "stageColor", 7, false));
  await addColumn("deals", () => tables.createDatetimeColumn(DB_ID, "deals", "expectedClose", false));
  await addColumn("deals", () => tables.createIntegerColumn(DB_ID, "deals", "probability", true, 0, 0, 100));
  await addColumn("deals", () => tables.createTextColumn(DB_ID, "deals", "notes", false));
  await addColumn("deals", () => tables.createTextColumn(DB_ID, "deals", "attachments", false));
  await addColumn("deals", () => tables.createBooleanColumn(DB_ID, "deals", "isRecurring", true, false));
  await addColumn("deals", () => tables.createIntegerColumn(DB_ID, "deals", "recurringMonths", false, 12));
  await addColumn("deals", () => tables.createDatetimeColumn(DB_ID, "deals", "recurringStartDate", false));
  await addColumn("deals", () => tables.createDatetimeColumn(DB_ID, "deals", "wonAt", false));
  await addColumn("deals", () => tables.createDatetimeColumn(DB_ID, "deals", "createdAt", true));
  await addColumn("deals", () => tables.createDatetimeColumn(DB_ID, "deals", "updatedAt", true));
  await addIndex("deals", "idx_stageId", "KEY", ["stageId"]);
  await addIndex("deals", "idx_contactId", "KEY", ["contactId"]);
  await addIndex("deals", "idx_createdAt", "KEY", ["createdAt"]);

  // === ACTIVITIES ===
  await ensureTable("activities", "Activities");
  await addColumn("activities", () => tables.createEnumColumn(DB_ID, "activities", "type", ["call", "email", "meeting", "note", "follow_up"], true));
  await addColumn("activities", () => tables.createTextColumn(DB_ID, "activities", "description", true));
  await addColumn("activities", () => tables.createStringColumn(DB_ID, "activities", "contactId", 128, true));
  await addColumn("activities", () => tables.createStringColumn(DB_ID, "activities", "contactName", 255, false));
  await addColumn("activities", () => tables.createStringColumn(DB_ID, "activities", "dealId", 128, false));
  await addColumn("activities", () => tables.createDatetimeColumn(DB_ID, "activities", "startAt", false));
  await addColumn("activities", () => tables.createDatetimeColumn(DB_ID, "activities", "endAt", false));
  await addColumn("activities", () => tables.createTextColumn(DB_ID, "activities", "notes", false));
  await addColumn("activities", () => tables.createTextColumn(DB_ID, "activities", "attachments", false));
  await addColumn("activities", () => tables.createDatetimeColumn(DB_ID, "activities", "scheduledAt", false));
  await addColumn("activities", () => tables.createDatetimeColumn(DB_ID, "activities", "completedAt", false));
  await addColumn("activities", () => tables.createBooleanColumn(DB_ID, "activities", "isCompleted", true, false));
  await addColumn("activities", () => tables.createDatetimeColumn(DB_ID, "activities", "createdAt", true));
  await addIndex("activities", "idx_contactId", "KEY", ["contactId"]);
  await addIndex("activities", "idx_dealId", "KEY", ["dealId"]);
  await addIndex("activities", "idx_isCompleted", "KEY", ["isCompleted"]);
  await addIndex("activities", "idx_scheduledAt", "KEY", ["scheduledAt"]);

  // === CRM SETTINGS ===
  await ensureTable("crm_settings", "CRM Settings");
  await addColumn("crm_settings", () => tables.createStringColumn(DB_ID, "crm_settings", "key", 128, true));
  await addColumn("crm_settings", () => tables.createTextColumn(DB_ID, "crm_settings", "value", true));
  await addIndex("crm_settings", "idx_key_unique", "UNIQUE", ["key"]);

  // === TASKS ===
  await ensureTable("tasks", "Tasks");
  await addColumn("tasks", () => tables.createStringColumn(DB_ID, "tasks", "title", 255, true));
  await addColumn("tasks", () => tables.createTextColumn(DB_ID, "tasks", "description", false));
  await addColumn("tasks", () => tables.createStringColumn(DB_ID, "tasks", "assignedTo", 255, true));
  await addColumn("tasks", () => tables.createStringColumn(DB_ID, "tasks", "createdBy", 255, true));
  await addColumn("tasks", () => tables.createBooleanColumn(DB_ID, "tasks", "done", true, false));
  await addColumn("tasks", () => tables.createDatetimeColumn(DB_ID, "tasks", "dueAt", false));
  await addColumn("tasks", () => tables.createDatetimeColumn(DB_ID, "tasks", "createdAt", true));
  await addColumn("tasks", () => tables.createDatetimeColumn(DB_ID, "tasks", "updatedAt", true));

  // === MESSAGES ===
  await ensureTable("messages", "Messages");
  await addColumn("messages", () => tables.createStringColumn(DB_ID, "messages", "author", 255, true));
  await addColumn("messages", () => tables.createTextColumn(DB_ID, "messages", "content", true));
  await addColumn("messages", () => tables.createDatetimeColumn(DB_ID, "messages", "createdAt", true));

  // === EXPENSES ===
  await ensureTable("expenses", "Expenses");
  await addColumn("expenses", () => tables.createEnumColumn(DB_ID, "expenses", "type", ["spesa", "investimento", "stipendio"], true, "spesa"));
  await addColumn("expenses", () => tables.createStringColumn(DB_ID, "expenses", "category", 128, true, "Altro"));
  await addColumn("expenses", () => tables.createTextColumn(DB_ID, "expenses", "description", true));
  await addColumn("expenses", () => tables.createIntegerColumn(DB_ID, "expenses", "amount", true));
  await addColumn("expenses", () => tables.createDatetimeColumn(DB_ID, "expenses", "date", true));
  await addColumn("expenses", () => tables.createStringColumn(DB_ID, "expenses", "createdBy", 255, true, "Team"));
  await addColumn("expenses", () => tables.createDatetimeColumn(DB_ID, "expenses", "createdAt", true));
  await addColumn("expenses", () => tables.createDatetimeColumn(DB_ID, "expenses", "updatedAt", true));
  await addIndex("expenses", "idx_date", "KEY", ["date"]);

  // === QUOTES ===
  await ensureTable("quotes", "Quotes");
  await addColumn("quotes", () => tables.createStringColumn(DB_ID, "quotes", "dealId", 128, true));
  await addColumn("quotes", () => tables.createStringColumn(DB_ID, "quotes", "number", 64, true));
  await addColumn("quotes", () => tables.createStringColumn(DB_ID, "quotes", "title", 255, true));
  await addColumn("quotes", () => tables.createTextColumn(DB_ID, "quotes", "items", true));
  await addColumn("quotes", () => tables.createTextColumn(DB_ID, "quotes", "notes", false));
  await addColumn("quotes", () => tables.createEnumColumn(DB_ID, "quotes", "status", ["bozza", "inviato", "accettato", "rifiutato"], true, "bozza"));
  await addColumn("quotes", () => tables.createIntegerColumn(DB_ID, "quotes", "vatRate", true, 22));
  await addColumn("quotes", () => tables.createDatetimeColumn(DB_ID, "quotes", "validUntil", false));
  await addColumn("quotes", () => tables.createDatetimeColumn(DB_ID, "quotes", "createdAt", true));
  await addColumn("quotes", () => tables.createDatetimeColumn(DB_ID, "quotes", "updatedAt", true));
  await addIndex("quotes", "idx_dealId", "KEY", ["dealId"]);

  // Seed default pipeline stages
  console.log("\n--- Seeding Pipeline Stages ---\n");
  const { total } = await databases.listDocuments(DB_ID, "pipeline_stages", [Query.limit(1)]);
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
      await databases.createDocument(DB_ID, "pipeline_stages", ID.unique(), stage);
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
