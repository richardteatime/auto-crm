import { Client, Databases, ID, Query, Storage } from "node-appwrite";

// node-appwrite v17 uses string literals for index types
type IndexType = "key" | "unique" | "fulltext";
import { config } from "dotenv";
config({ path: ".env.local" });

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause instanceof Error ? error.cause.message : "";
  return /fetch failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|socket hang up|UND_ERR/i.test(
    `${error.message} ${cause}`,
  );
}

async function withRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (!isTransientNetworkError(error) || attempt === maxAttempts) throw error;
      const delayMs = attempt * 750;
      console.warn(`    Transient network error during ${label}; retry ${attempt}/${maxAttempts - 1}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Unreachable retry state: ${label}`);
}

async function main() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const db = new Databases(client);
  const storage = new Storage(client);

  console.log(`Using database: ${DB_ID}`);
  console.log(`Endpoint: ${APPWRITE_ENDPOINT}`);

  // Helper to create collection
  async function ensureCollection(collectionId: string, name: string) {
    try {
      await withRetry(`create collection "${collectionId}"`, () =>
        db.createCollection(DB_ID, collectionId, name),
      );
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
      await withRetry(`create attribute in "${collectionId}"`, factory);
    } catch (e: unknown) {
      if (e instanceof Error && (e.message.includes("already exists") || e.message.includes("Duplicate"))) {
        // Attribute exists, skip
      } else {
        throw e;
      }
    }
  }

  // Helper to create index (ignore if exists)
  async function addIndex(collectionId: string, key: string, type: IndexType, attrs: string[]) {
    try {
      await withRetry(`create index "${collectionId}.${key}"`, () =>
        db.createIndex(DB_ID, collectionId, key, type, attrs),
      );
      console.log(`    Index "${key}" created`);
    } catch (e: unknown) {
      if (e instanceof Error && (e.message.includes("already exists") || e.message.includes("Duplicate"))) {
        // Index exists, skip
      } else {
        throw e;
      }
    }
  }

  async function ensureStringAttributeOptional(collectionId: string, key: string, size: number) {
    const attribute = await withRetry(`read attribute "${collectionId}.${key}"`, () =>
      db.getAttribute(DB_ID, collectionId, key),
    ) as {
      required?: boolean;
    };
    if (attribute.required === false) return;

    await withRetry(`update attribute "${collectionId}.${key}"`, () =>
      // The generated SDK runtime requires the nullable default parameter even
      // though its TypeScript declaration marks it optional.
      db.updateStringAttribute(DB_ID, collectionId, key, false, null as unknown as string, size),
    );
    console.log(`    Attribute "${collectionId}.${key}" migrated to optional`);
  }

  // Shorthand helpers matching old column API
  // In Appwrite 1.7.4: cannot set default on required attributes.
  // When a default is provided, the attribute must be optional.
  const str = (col: string, key: string, size: number, req: boolean, def?: string) =>
    () => db.createStringAttribute(DB_ID, col, key, size, def !== undefined ? false : req, def);
  const email = (col: string, key: string, req: boolean) =>
    () => db.createEmailAttribute(DB_ID, col, key, req);
  const text = (col: string, key: string, req: boolean, size = 16384) =>
    () => db.createStringAttribute(DB_ID, col, key, size, req);
  const int = (col: string, key: string, req: boolean, def?: number, min?: number, max?: number) =>
    () => db.createIntegerAttribute(DB_ID, col, key, def !== undefined ? false : req, min, max, def);
  const bool = (col: string, key: string, req: boolean, def?: boolean) =>
    () => db.createBooleanAttribute(DB_ID, col, key, def !== undefined ? false : req, def);
  const dt = (col: string, key: string, req: boolean) =>
    () => db.createDatetimeAttribute(DB_ID, col, key, req);
  const enm = (col: string, key: string, elements: string[], req: boolean, def?: string) =>
    () => db.createEnumAttribute(DB_ID, col, key, elements, def !== undefined ? false : req, def);

  console.log("\n--- Creating Collections ---\n");

  // === CONTACTS ===
  await ensureCollection("contacts", "Contacts");
  await addAttr("contacts", str("contacts", "name", 255, true));
  await addAttr("contacts", email("contacts", "email", false));
  await addAttr("contacts", str("contacts", "phone", 50, false));
  await addAttr("contacts", str("contacts", "company", 255, false));
  await addAttr("contacts", str("contacts", "vatNumber", 50, false));
  await addAttr("contacts", str("contacts", "address", 500, false));
  await addAttr("contacts", enm("contacts", "source", ["website", "whatsapp", "referido", "redes_sociales", "llamada_fria", "email", "formulario", "evento", "import", "webhook", "otro"], true, "otro"));
  await addAttr("contacts", enm("contacts", "temperature", ["cold", "warm", "hot"], true, "cold"));
  await addAttr("contacts", text("contacts", "notes", false));
  await addAttr("contacts", dt("contacts", "createdAt", true));
  await addAttr("contacts", dt("contacts", "updatedAt", true));
  await addIndex("contacts", "idx_temperature", "key", ["temperature"]);
  await addIndex("contacts", "idx_source", "key", ["source"]);
  await addIndex("contacts", "idx_email", "key", ["email"]);
  await addIndex("contacts", "idx_phone", "key", ["phone"]);
  await addIndex("contacts", "idx_createdAt", "key", ["createdAt"]);

  // === PIPELINE STAGES ===
  await ensureCollection("pipeline_stages", "Pipeline Stages");
  await addAttr("pipeline_stages", str("pipeline_stages", "name", 128, true));
  await addAttr("pipeline_stages", int("pipeline_stages", "order", true, 1));
  await addAttr("pipeline_stages", str("pipeline_stages", "color", 7, true, "#64748b"));
  await addAttr("pipeline_stages", bool("pipeline_stages", "isWon", true, false));
  await addAttr("pipeline_stages", bool("pipeline_stages", "isLost", true, false));
  await addIndex("pipeline_stages", "idx_order", "key", ["order"]);

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
  await addAttr("deals", enm("deals", "billingType", ["una_tantum", "mensile", "annuale"], false, "una_tantum"));
  await addAttr("deals", int("deals", "recurringMonths", false, 12));
  await addAttr("deals", dt("deals", "recurringStartDate", false));
  await addAttr("deals", dt("deals", "wonAt", false));
  await addAttr("deals", bool("deals", "isPaid", true, false));
  await addAttr("deals", dt("deals", "createdAt", true));
  await addAttr("deals", dt("deals", "updatedAt", true));
  await addIndex("deals", "idx_stageId", "key", ["stageId"]);
  await addIndex("deals", "idx_contactId", "key", ["contactId"]);
  await addIndex("deals", "idx_createdAt", "key", ["createdAt"]);

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
  await addAttr("activities", str("activities", "assignedTo", 128, false));
  await addAttr("activities", dt("activities", "createdAt", true));
  await addIndex("activities", "idx_contactId", "key", ["contactId"]);
  await addIndex("activities", "idx_dealId", "key", ["dealId"]);
  await addIndex("activities", "idx_isCompleted", "key", ["isCompleted"]);
  await addIndex("activities", "idx_scheduledAt", "key", ["scheduledAt"]);
  await addIndex("activities", "idx_assignedTo", "key", ["assignedTo"]);

  // === CRM SETTINGS ===
  await ensureCollection("crm_settings", "CRM Settings");
  await addAttr("crm_settings", str("crm_settings", "key", 128, true));
  await addAttr("crm_settings", text("crm_settings", "value", true));
  await addIndex("crm_settings", "idx_key_unique", "unique", ["key"]);

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
  await addIndex("expenses", "idx_date", "key", ["date"]);

  // === REVENUES ===
  await ensureCollection("revenues", "Revenues");
  await addAttr("revenues", text("revenues", "description", true));
  await addAttr("revenues", int("revenues", "amount", true));
  await addAttr("revenues", dt("revenues", "date", true));
  await addAttr("revenues", enm("revenues", "billingType", ["una_tantum", "mensile", "annuale"], true, "una_tantum"));
  await addAttr("revenues", int("revenues", "recurringMonths", false));
  await addAttr("revenues", dt("revenues", "startDate", false));
  await addAttr("revenues", text("revenues", "collectedBy", false));
  await addAttr("revenues", bool("revenues", "isExternal", true, false));
  await addAttr("revenues", text("revenues", "notes", false));
  await addAttr("revenues", str("revenues", "dealId", 128, false));
  await addAttr("revenues", str("revenues", "opportunityId", 128, false));
  await addAttr("revenues", text("revenues", "deleteReason", false));
  await addAttr("revenues", dt("revenues", "deletedAt", false));
  await addAttr("revenues", dt("revenues", "createdAt", true));
  await addAttr("revenues", dt("revenues", "updatedAt", true));
  await addIndex("revenues", "idx_date", "key", ["date"]);
  await addIndex("revenues", "idx_deletedAt", "key", ["deletedAt"]);
  await addIndex("revenues", "idx_dealId", "key", ["dealId"]);
  await addIndex("revenues", "idx_opportunityId", "key", ["opportunityId"]);

  // === QUOTES ===
  await ensureCollection("quotes", "Quotes");
  await addAttr("quotes", str("quotes", "dealId", 128, true));
  await addAttr("quotes", str("quotes", "number", 64, true));
  await addAttr("quotes", str("quotes", "title", 255, true));
  await addAttr("quotes", text("quotes", "items", true, 100000));
  await addAttr("quotes", text("quotes", "notes", false, 100000));
  await addAttr("quotes", enm("quotes", "status", ["bozza", "inviato", "accettato", "rifiutato"], true, "bozza"));
  await addAttr("quotes", int("quotes", "vatRate", true, 22));
  await addAttr("quotes", dt("quotes", "validUntil", false));
  await addAttr("quotes", dt("quotes", "createdAt", true));
  await addAttr("quotes", dt("quotes", "updatedAt", true));
  await addIndex("quotes", "idx_dealId", "key", ["dealId"]);
  await addIndex("quotes", "idx_number", "key", ["number"]);

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

  // === CALENDAR EVENTS ===
  await ensureCollection("calendar_events", "Calendar Events");
  await addAttr("calendar_events", str("calendar_events", "title", 255, true));
  await addAttr("calendar_events", text("calendar_events", "description", false));
  await addAttr("calendar_events", dt("calendar_events", "startAt", true));
  await addAttr("calendar_events", dt("calendar_events", "endAt", true));
  await addAttr("calendar_events", bool("calendar_events", "allDay", true, false));
  await addAttr("calendar_events", enm("calendar_events", "type", ["activity", "meeting", "call", "travel", "out_of_office", "personal", "other"], true, "activity"));
  await addAttr("calendar_events", str("calendar_events", "assignedTo", 255, false));
  await addAttr("calendar_events", str("calendar_events", "createdBy", 255, true));
  await addAttr("calendar_events", str("calendar_events", "contactId", 128, false));
  await addAttr("calendar_events", str("calendar_events", "dealId", 128, false));
  await addAttr("calendar_events", str("calendar_events", "projectId", 128, false));
  await addAttr("calendar_events", str("calendar_events", "location", 500, false));
  await addAttr("calendar_events", str("calendar_events", "color", 7, false));
  await addAttr("calendar_events", bool("calendar_events", "isPrivate", true, false));
  await addAttr("calendar_events", dt("calendar_events", "createdAt", true));
  await addAttr("calendar_events", dt("calendar_events", "updatedAt", true));
  await addIndex("calendar_events", "idx_startAt", "key", ["startAt"]);
  await addIndex("calendar_events", "idx_endAt", "key", ["endAt"]);
  await addIndex("calendar_events", "idx_createdBy", "key", ["createdBy"]);

  // === NOTIFICATIONS ===
  await ensureCollection("notifications", "Notifications");
  await addAttr("notifications", str("notifications", "userId", 255, true));
  await addAttr("notifications", str("notifications", "type", 100, true));
  await addAttr("notifications", str("notifications", "title", 500, true));
  await addAttr("notifications", str("notifications", "body", 1000, false));
  await addAttr("notifications", str("notifications", "relatedId", 255, false));
  await addAttr("notifications", str("notifications", "relatedType", 50, false));
  await addAttr("notifications", str("notifications", "fromUserId", 255, false));
  await addAttr("notifications", str("notifications", "fromUserName", 255, false));
  await addAttr("notifications", bool("notifications", "read", true, false));
  await addIndex("notifications", "idx_userId", "key", ["userId"]);
  await addIndex("notifications", "idx_read", "key", ["read"]);

  // === CHATWOOT MESSAGES ===
  await ensureCollection("chatwoot_messages", "Chatwoot Messages");
  await addAttr("chatwoot_messages", str("chatwoot_messages", "chatwootMessageId", 128, true));
  await addAttr("chatwoot_messages", str("chatwoot_messages", "conversationId", 128, true));
  await addAttr("chatwoot_messages", str("chatwoot_messages", "chatwootContactId", 128, true));
  await addAttr("chatwoot_messages", str("chatwoot_messages", "senderPhone", 50, false));
  await addAttr("chatwoot_messages", str("chatwoot_messages", "senderName", 255, false));
  await addAttr("chatwoot_messages", enm("chatwoot_messages", "direction", ["inbound", "outbound", "system"], true, "inbound"));
  await addAttr("chatwoot_messages", text("chatwoot_messages", "messageText", true));
  await addAttr("chatwoot_messages", str("chatwoot_messages", "messageType", 50, true, "text"));
  await addAttr("chatwoot_messages", text("chatwoot_messages", "rawPayload", true));
  await addAttr("chatwoot_messages", bool("chatwoot_messages", "processed", true, false));
  await addAttr("chatwoot_messages", dt("chatwoot_messages", "createdAt", true));
  await addAttr("chatwoot_messages", dt("chatwoot_messages", "updatedAt", true));
  await addIndex("chatwoot_messages", "idx_conversationId", "key", ["conversationId"]);
  await addIndex("chatwoot_messages", "idx_senderPhone", "key", ["senderPhone"]);
  await addIndex("chatwoot_messages", "idx_processed", "key", ["processed"]);
  await addIndex("chatwoot_messages", "idx_createdAt", "key", ["createdAt"]);

  // === CRM OPERATORS ===
  await ensureCollection("crm_operators", "CRM Operators");
  await addAttr("crm_operators", str("crm_operators", "name", 255, true));
  await addAttr("crm_operators", str("crm_operators", "appwriteUserId", 128, false));
  await addAttr("crm_operators", str("crm_operators", "telegramUserId", 128, false));
  await addAttr("crm_operators", str("crm_operators", "chatwootContactId", 128, false));
  await addAttr("crm_operators", str("crm_operators", "chatwootAgentId", 128, false));
  await addAttr("crm_operators", enm("crm_operators", "role", ["admin", "sales", "finance", "operations", "developer"], true));
  await addAttr("crm_operators", text("crm_operators", "scopes", true, 8192));
  await addAttr("crm_operators", bool("crm_operators", "active", true, true));
  await addAttr("crm_operators", text("crm_operators", "notes", false));
  await addAttr("crm_operators", dt("crm_operators", "createdAt", true));
  await addAttr("crm_operators", dt("crm_operators", "updatedAt", true));
  await addIndex("crm_operators", "idx_telegramUserId", "key", ["telegramUserId"]);
  await addIndex("crm_operators", "idx_chatwootContactId", "key", ["chatwootContactId"]);
  await addIndex("crm_operators", "idx_role", "key", ["role"]);
  await addIndex("crm_operators", "idx_active", "key", ["active"]);

  // === TELEGRAM MESSAGES ===
  await ensureCollection("telegram_messages", "Telegram Messages");
  await addAttr("telegram_messages", str("telegram_messages", "updateId", 128, true));
  await addAttr("telegram_messages", str("telegram_messages", "messageId", 128, true));
  await addAttr("telegram_messages", str("telegram_messages", "chatId", 128, true));
  await addAttr("telegram_messages", str("telegram_messages", "senderTelegramId", 128, false));
  await addAttr("telegram_messages", str("telegram_messages", "senderName", 255, false));
  await addAttr("telegram_messages", str("telegram_messages", "username", 255, false));
  await addAttr("telegram_messages", enm("telegram_messages", "direction", ["inbound"], true, "inbound"));
  await addAttr("telegram_messages", text("telegram_messages", "messageText", true, 16384));
  await addAttr("telegram_messages", str("telegram_messages", "messageType", 50, true, "text"));
  await addAttr("telegram_messages", text("telegram_messages", "rawPayload", true, 65535));
  await addAttr("telegram_messages", bool("telegram_messages", "processed", true, false));
  await addAttr("telegram_messages", str("telegram_messages", "runId", 128, false));
  await addAttr("telegram_messages", dt("telegram_messages", "createdAt", true));
  await addAttr("telegram_messages", dt("telegram_messages", "updatedAt", true));
  await addIndex("telegram_messages", "idx_updateId_unique", "unique", ["updateId"]);
  await addIndex("telegram_messages", "idx_chatId", "key", ["chatId"]);
  await addIndex("telegram_messages", "idx_senderTelegramId", "key", ["senderTelegramId"]);
  await addIndex("telegram_messages", "idx_processed", "key", ["processed"]);
  await addIndex("telegram_messages", "idx_createdAt", "key", ["createdAt"]);

  // === TELEGRAM OUTBOX ===
  await ensureCollection("telegram_outbox", "Telegram Outbox");
  await addAttr("telegram_outbox", str("telegram_outbox", "chatId", 128, true));
  await addAttr("telegram_outbox", text("telegram_outbox", "messageText", true, 16384));
  await addAttr("telegram_outbox", enm("telegram_outbox", "status", ["pending", "sent", "failed"], true, "pending"));
  await addAttr("telegram_outbox", str("telegram_outbox", "telegramMessageId", 128, false));
  await addAttr("telegram_outbox", str("telegram_outbox", "runId", 128, false));
  await addAttr("telegram_outbox", text("telegram_outbox", "error", false));
  await addAttr("telegram_outbox", dt("telegram_outbox", "sentAt", false));
  await addAttr("telegram_outbox", dt("telegram_outbox", "createdAt", true));
  await addAttr("telegram_outbox", dt("telegram_outbox", "updatedAt", true));
  await addIndex("telegram_outbox", "idx_chatId", "key", ["chatId"]);
  await addIndex("telegram_outbox", "idx_status", "key", ["status"]);
  await addIndex("telegram_outbox", "idx_runId", "key", ["runId"]);
  await addIndex("telegram_outbox", "idx_createdAt", "key", ["createdAt"]);

  // === COMMAND CONFIRMATIONS ===
  await ensureCollection("command_confirmations", "Command Confirmations");
  await addAttr("command_confirmations", str("command_confirmations", "source", 64, true));
  await addAttr("command_confirmations", str("command_confirmations", "conversationId", 128, true));
  await addAttr("command_confirmations", str("command_confirmations", "senderTelegramId", 128, false));
  await addAttr("command_confirmations", str("command_confirmations", "operatorId", 128, false));
  await addAttr("command_confirmations", str("command_confirmations", "operatorRole", 64, false));
  await addAttr("command_confirmations", str("command_confirmations", "senderRole", 64, true));
  await addAttr("command_confirmations", text("command_confirmations", "commandText", true, 16384));
  await addAttr("command_confirmations", str("command_confirmations", "toolName", 128, true));
  await addAttr("command_confirmations", text("command_confirmations", "toolArgs", true, 65535));
  await addAttr("command_confirmations", enm("command_confirmations", "riskLevel", ["low", "medium", "high", "critical"], true, "medium"));
  await addAttr("command_confirmations", enm("command_confirmations", "status", ["pending", "confirmed", "cancelled", "expired", "executed"], true, "pending"));
  await addAttr("command_confirmations", str("command_confirmations", "confirmationCode", 32, true));
  await addAttr("command_confirmations", str("command_confirmations", "requestedRunId", 128, false));
  await addAttr("command_confirmations", str("command_confirmations", "executedRunId", 128, false));
  await addAttr("command_confirmations", text("command_confirmations", "resultSummary", false));
  await addAttr("command_confirmations", dt("command_confirmations", "expiresAt", true));
  await addAttr("command_confirmations", dt("command_confirmations", "respondedAt", false));
  await addAttr("command_confirmations", dt("command_confirmations", "createdAt", true));
  await addAttr("command_confirmations", dt("command_confirmations", "updatedAt", true));
  await addIndex("command_confirmations", "idx_source_conversation_status", "key", ["source", "conversationId", "status"]);
  await addIndex("command_confirmations", "idx_operatorId", "key", ["operatorId"]);
  await addIndex("command_confirmations", "idx_senderTelegramId", "key", ["senderTelegramId"]);
  await addIndex("command_confirmations", "idx_confirmationCode", "key", ["confirmationCode"]);
  await addIndex("command_confirmations", "idx_expiresAt", "key", ["expiresAt"]);

  // === ORCHESTRATOR RUNS ===
  await ensureCollection("orchestrator_runs", "Orchestrator Runs");
  await addAttr("orchestrator_runs", str("orchestrator_runs", "source", 128, true));
  await addAttr("orchestrator_runs", str("orchestrator_runs", "senderPhone", 50, false));
  await addAttr("orchestrator_runs", enm("orchestrator_runs", "senderRole", ["founder_admin", "team_member", "developer", "sales", "customer", "unknown"], true, "unknown"));
  await addAttr("orchestrator_runs", str("orchestrator_runs", "contactId", 128, false));
  await addAttr("orchestrator_runs", str("orchestrator_runs", "dealId", 128, false));
  await addAttr("orchestrator_runs", str("orchestrator_runs", "projectId", 128, false));
  await addAttr("orchestrator_runs", str("orchestrator_runs", "intent", 128, true, "unknown"));
  await addAttr("orchestrator_runs", str("orchestrator_runs", "workflow", 128, false));
  await addAttr("orchestrator_runs", enm("orchestrator_runs", "status", ["pending", "running", "waiting_for_data", "pending_dispatch", "dispatched", "completed", "failed", "cancelled", "unauthorized"], true, "pending"));
  await addAttr("orchestrator_runs", text("orchestrator_runs", "commandText", true));
  await addAttr("orchestrator_runs", text("orchestrator_runs", "resultSummary", false));
  await addAttr("orchestrator_runs", enm("orchestrator_runs", "riskLevel", ["low", "medium", "high", "critical"], true, "low"));
  await addAttr("orchestrator_runs", bool("orchestrator_runs", "autodeploy", true, false));
  await addAttr("orchestrator_runs", str("orchestrator_runs", "currentStep", 255, false));
  await addAttr("orchestrator_runs", str("orchestrator_runs", "finalUrl", 2048, false));
  await addAttr("orchestrator_runs", str("orchestrator_runs", "repoUrl", 2048, false));
  await addAttr("orchestrator_runs", str("orchestrator_runs", "conversationId", 128, false));
  await addAttr("orchestrator_runs", text("orchestrator_runs", "error", false));
  await addAttr("orchestrator_runs", dt("orchestrator_runs", "createdAt", true));
  await addAttr("orchestrator_runs", dt("orchestrator_runs", "updatedAt", true));
  await addIndex("orchestrator_runs", "idx_status", "key", ["status"]);
  await addIndex("orchestrator_runs", "idx_senderPhone", "key", ["senderPhone"]);
  await addIndex("orchestrator_runs", "idx_intent", "key", ["intent"]);
  await addIndex("orchestrator_runs", "idx_createdAt", "key", ["createdAt"]);

  // === WORKFLOW EVENTS ===
  await ensureCollection("workflow_events", "Workflow Events");
  await addAttr("workflow_events", str("workflow_events", "runId", 128, false));
  await ensureStringAttributeOptional("workflow_events", "runId", 128);
  await addAttr("workflow_events", enm("workflow_events", "eventType", ["message_received", "permission_checked", "intent_classified", "query_executed", "command_executed", "project_created", "deal_created", "task_created", "workflow_started", "gitagent_dispatched", "gitagent_callback_received", "deploy_callback_received", "final_url_saved", "reply_sent", "unauthorized", "error"], true));
  await addAttr("workflow_events", text("workflow_events", "message", true));
  await addAttr("workflow_events", text("workflow_events", "metadata", false));
  await addAttr("workflow_events", dt("workflow_events", "createdAt", true));
  await addIndex("workflow_events", "idx_runId", "key", ["runId"]);
  await addIndex("workflow_events", "idx_eventType", "key", ["eventType"]);
  await addIndex("workflow_events", "idx_createdAt", "key", ["createdAt"]);

  // === AGENT TASKS ===
  await ensureCollection("agent_tasks", "Agent Tasks");
  await addAttr("agent_tasks", str("agent_tasks", "runId", 128, true));
  await addAttr("agent_tasks", str("agent_tasks", "agentName", 128, true));
  await addAttr("agent_tasks", str("agent_tasks", "taskType", 128, true));
  await addAttr("agent_tasks", enm("agent_tasks", "status", ["pending", "running", "completed", "failed", "cancelled"], true, "pending"));
  await addAttr("agent_tasks", text("agent_tasks", "input", true));
  await addAttr("agent_tasks", text("agent_tasks", "output", false));
  await addAttr("agent_tasks", text("agent_tasks", "error", false));
  await addAttr("agent_tasks", dt("agent_tasks", "startedAt", false));
  await addAttr("agent_tasks", dt("agent_tasks", "completedAt", false));
  await addAttr("agent_tasks", dt("agent_tasks", "createdAt", true));
  await addAttr("agent_tasks", dt("agent_tasks", "updatedAt", true));
  await addIndex("agent_tasks", "idx_runId", "key", ["runId"]);
  await addIndex("agent_tasks", "idx_status", "key", ["status"]);
  await addIndex("agent_tasks", "idx_createdAt", "key", ["createdAt"]);

  // === PROJECT ARTIFACTS ===
  await ensureCollection("project_artifacts", "Project Artifacts");
  await addAttr("project_artifacts", str("project_artifacts", "runId", 128, true));
  await addAttr("project_artifacts", str("project_artifacts", "projectId", 128, false));
  await addAttr("project_artifacts", enm("project_artifacts", "artifactType", ["repo", "branch", "qa_report", "build_log", "deploy_package", "preview_url", "final_url", "handover_doc"], true));
  await addAttr("project_artifacts", str("project_artifacts", "name", 255, true));
  await addAttr("project_artifacts", str("project_artifacts", "url", 2048, false));
  await addAttr("project_artifacts", text("project_artifacts", "content", false));
  await addAttr("project_artifacts", text("project_artifacts", "metadata", false));
  await addAttr("project_artifacts", dt("project_artifacts", "createdAt", true));
  await addAttr("project_artifacts", dt("project_artifacts", "updatedAt", true));
  await addIndex("project_artifacts", "idx_runId", "key", ["runId"]);
  await addIndex("project_artifacts", "idx_projectId", "key", ["projectId"]);
  await addIndex("project_artifacts", "idx_artifactType", "key", ["artifactType"]);
  await addIndex("project_artifacts", "idx_createdAt", "key", ["createdAt"]);

  // === DEPLOYMENT RESULTS ===
  await ensureCollection("deployment_results", "Deployment Results");
  await addAttr("deployment_results", str("deployment_results", "runId", 128, true));
  await addAttr("deployment_results", str("deployment_results", "projectId", 128, false));
  await addAttr("deployment_results", enm("deployment_results", "environment", ["preview", "staging", "production"], true, "preview"));
  await addAttr("deployment_results", str("deployment_results", "status", 128, true));
  await addAttr("deployment_results", str("deployment_results", "url", 2048, false));
  await addAttr("deployment_results", str("deployment_results", "provider", 128, true));
  await addAttr("deployment_results", str("deployment_results", "healthcheckStatus", 128, false));
  await addAttr("deployment_results", bool("deployment_results", "rollbackAvailable", true, false));
  await addAttr("deployment_results", text("deployment_results", "logs", false));
  await addAttr("deployment_results", dt("deployment_results", "createdAt", true));
  await addAttr("deployment_results", dt("deployment_results", "updatedAt", true));
  await addIndex("deployment_results", "idx_runId", "key", ["runId"]);
  await addIndex("deployment_results", "idx_projectId", "key", ["projectId"]);
  await addIndex("deployment_results", "idx_environment", "key", ["environment"]);
  await addIndex("deployment_results", "idx_createdAt", "key", ["createdAt"]);

  // === AUTOMATION POLICIES ===
  await ensureCollection("automation_policies", "Automation Policies");
  await addAttr("automation_policies", str("automation_policies", "name", 255, true));
  await addAttr("automation_policies", str("automation_policies", "workflow", 128, true));
  await addAttr("automation_policies", bool("automation_policies", "enabled", true, true));
  await addAttr("automation_policies", text("automation_policies", "allowedRiskLevels", false));
  await addAttr("automation_policies", bool("automation_policies", "requireQA", true, true));
  await addAttr("automation_policies", bool("automation_policies", "requireHealthCheck", true, true));
  await addAttr("automation_policies", bool("automation_policies", "rollbackOnFail", true, true));
  await addAttr("automation_policies", bool("automation_policies", "customerEnabled", true, false));
  await addAttr("automation_policies", dt("automation_policies", "createdAt", true));
  await addAttr("automation_policies", dt("automation_policies", "updatedAt", true));
  await addIndex("automation_policies", "idx_workflow", "key", ["workflow"]);
  await addIndex("automation_policies", "idx_enabled", "key", ["enabled"]);
  await addIndex("automation_policies", "idx_createdAt", "key", ["createdAt"]);

  // Seed default automation policy
  console.log("\n--- Seeding Automation Policies ---\n");
  try {
    const { total } = await db.listDocuments(DB_ID, "automation_policies", [Query.limit(1)]);
    if (total === 0) {
      await db.createDocument(DB_ID, "automation_policies", ID.unique(), {
        name: "Internal preview automation",
        workflow: "generate_app",
        enabled: true,
        allowedRiskLevels: JSON.stringify(["low"]),
        requireQA: true,
        requireHealthCheck: true,
        rollbackOnFail: true,
        customerEnabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log('  Default policy "Internal preview automation" created');
    } else {
      console.log("  Automation policies already exist, skipping seed");
    }
  } catch (e: unknown) {
    throw e;
  }

  // =========================================================================
  // LEAD PIPELINE AUTOMATION MVP
  // =========================================================================

  // === LEADS ===
  await ensureCollection("leads", "Leads");
  await addAttr("leads", str("leads", "firstName", 128, false));
  await addAttr("leads", str("leads", "lastName", 128, false));
  await addAttr("leads", str("leads", "fullName", 255, true));
  await addAttr("leads", email("leads", "email", false));
  await addAttr("leads", str("leads", "phone", 50, false));
  await addAttr("leads", str("leads", "company", 255, false));
  await addAttr("leads", str("leads", "businessName", 255, false));
  await addAttr("leads", str("leads", "website", 500, false));
  await addAttr("leads", str("leads", "projectType", 128, false));
  await addAttr("leads", enm("leads", "category", ["static_website", "webapp", "crm", "automation", "other", "unknown"], true, "unknown"));
  await addAttr("leads", str("leads", "source", 64, true, "email"));
  await addAttr("leads", str("leads", "formName", 128, false));
  await addAttr("leads", text("leads", "message", false));
  await addAttr("leads", str("leads", "rawSubject", 1000, false));
  await addAttr("leads", text("leads", "rawBody", false, 65535));
  await addAttr("leads", text("leads", "customFields", false));
  await addAttr("leads", enm("leads", "status", ["new", "to_call", "working", "qualified", "lost", "won"], true, "new"));
  await addAttr("leads", enm("leads", "pipelineStage", ["prospect", "opportunity", "contacted", "proposal"], true, "prospect"));
  await addAttr("leads", str("leads", "assignedTo", 128, false));
  await addAttr("leads", int("leads", "leadScore", true, 0, 0, 100));
  await addAttr("leads", str("leads", "contactId", 128, false));
  await addAttr("leads", str("leads", "landingPageId", 128, false));
  await addAttr("leads", str("leads", "formId", 128, false));
  await addAttr("leads", str("leads", "funnelId", 128, false));
  await addAttr("leads", str("leads", "bookingLinkId", 128, false));
  await addAttr("leads", dt("leads", "createdAt", true));
  await addAttr("leads", dt("leads", "updatedAt", true));
  await addIndex("leads", "idx_pipelineStage", "key", ["pipelineStage"]);
  await addIndex("leads", "idx_landingPageId", "key", ["landingPageId"]);
  await addIndex("leads", "idx_formId", "key", ["formId"]);
  await addIndex("leads", "idx_funnelId", "key", ["funnelId"]);
  await addIndex("leads", "idx_status", "key", ["status"]);
  await addIndex("leads", "idx_category", "key", ["category"]);
  await addIndex("leads", "idx_email", "key", ["email"]);
  await addIndex("leads", "idx_phone", "key", ["phone"]);
  await addIndex("leads", "idx_createdAt", "key", ["createdAt"]);

  // === PIPELINE MOVEMENTS ===
  await ensureCollection("pipeline_movements", "Pipeline Movements");
  await addAttr("pipeline_movements", str("pipeline_movements", "leadId", 128, true));
  await addAttr("pipeline_movements", str("pipeline_movements", "fromStage", 64, false));
  await addAttr("pipeline_movements", str("pipeline_movements", "toStage", 64, true));
  await addAttr("pipeline_movements", text("pipeline_movements", "reason", false));
  await addAttr("pipeline_movements", str("pipeline_movements", "triggeredBy", 128, true, "system"));
  await addAttr("pipeline_movements", text("pipeline_movements", "metadata", false));
  await addAttr("pipeline_movements", dt("pipeline_movements", "createdAt", true));
  await addIndex("pipeline_movements", "idx_leadId", "key", ["leadId"]);
  await addIndex("pipeline_movements", "idx_createdAt", "key", ["createdAt"]);

  // === AUTOMATION RULES ===
  await ensureCollection("automation_rules", "Automation Rules");
  await addAttr("automation_rules", str("automation_rules", "name", 255, true));
  await addAttr("automation_rules", bool("automation_rules", "enabled", true, true));
  await addAttr("automation_rules", str("automation_rules", "triggerType", 64, true));
  await addAttr("automation_rules", str("automation_rules", "pipelineStage", 64, false));
  await addAttr("automation_rules", str("automation_rules", "leadCategory", 64, false));
  await addAttr("automation_rules", text("automation_rules", "conditions", false));
  await addAttr("automation_rules", text("automation_rules", "actions", false));
  await addAttr("automation_rules", dt("automation_rules", "createdAt", true));
  await addAttr("automation_rules", dt("automation_rules", "updatedAt", true));
  await addIndex("automation_rules", "idx_triggerType", "key", ["triggerType"]);
  await addIndex("automation_rules", "idx_enabled", "key", ["enabled"]);

  // === AUTOMATION RUNS ===
  await ensureCollection("automation_runs", "Automation Runs");
  await addAttr("automation_runs", str("automation_runs", "ruleId", 128, false));
  await addAttr("automation_runs", str("automation_runs", "leadId", 128, true));
  await addAttr("automation_runs", str("automation_runs", "triggerType", 64, true));
  await addAttr("automation_runs", enm("automation_runs", "status", ["pending", "running", "completed", "failed", "partial"], true, "pending"));
  await addAttr("automation_runs", text("automation_runs", "actionsExecuted", false));
  await addAttr("automation_runs", text("automation_runs", "error", false));
  await addAttr("automation_runs", dt("automation_runs", "createdAt", true));
  await addAttr("automation_runs", dt("automation_runs", "updatedAt", true));
  await addIndex("automation_runs", "idx_leadId", "key", ["leadId"]);
  await addIndex("automation_runs", "idx_triggerType", "key", ["triggerType"]);
  await addIndex("automation_runs", "idx_status", "key", ["status"]);
  await addIndex("automation_runs", "idx_createdAt", "key", ["createdAt"]);

  // === CALL TASKS ===
  await ensureCollection("call_tasks", "Call Tasks");
  await addAttr("call_tasks", str("call_tasks", "leadId", 128, true));
  await addAttr("call_tasks", str("call_tasks", "assignedTo", 128, true));
  await addAttr("call_tasks", str("call_tasks", "assigneeName", 255, false));
  await addAttr("call_tasks", enm("call_tasks", "status", ["pending", "scheduled", "completed", "failed", "no_answer", "reschedule", "not_interested", "qualified"], true, "pending"));
  await addAttr("call_tasks", dt("call_tasks", "scheduledAt", false));
  await addAttr("call_tasks", dt("call_tasks", "completedAt", false));
  await addAttr("call_tasks", enm("call_tasks", "callOutcome", ["qualified", "not_qualified", "no_answer", "call_later", "wrong_number", "interested", "not_interested", "needs_quote"], false));
  await addAttr("call_tasks", text("call_tasks", "notes", false));
  await addAttr("call_tasks", dt("call_tasks", "createdAt", true));
  await addAttr("call_tasks", dt("call_tasks", "updatedAt", true));
  await addIndex("call_tasks", "idx_leadId", "key", ["leadId"]);
  await addIndex("call_tasks", "idx_assignedTo", "key", ["assignedTo"]);
  await addIndex("call_tasks", "idx_status", "key", ["status"]);
  await addIndex("call_tasks", "idx_createdAt", "key", ["createdAt"]);

  // === LEAD QUOTES (draft) ===
  await ensureCollection("lead_quotes", "Lead Quotes");
  await addAttr("lead_quotes", str("lead_quotes", "leadId", 128, true));
  await addAttr("lead_quotes", enm("lead_quotes", "status", ["draft", "approved", "sent", "rejected"], true, "draft"));
  await addAttr("lead_quotes", enm("lead_quotes", "category", ["static_website", "webapp", "crm", "automation", "other", "unknown"], true, "unknown"));
  await addAttr("lead_quotes", int("lead_quotes", "amountSuggested", true, 0));
  await addAttr("lead_quotes", text("lead_quotes", "items", true, 100000));
  await addAttr("lead_quotes", text("lead_quotes", "summary", false));
  await addAttr("lead_quotes", text("lead_quotes", "generatedText", false, 65535));
  await addAttr("lead_quotes", dt("lead_quotes", "createdAt", true));
  await addAttr("lead_quotes", dt("lead_quotes", "updatedAt", true));
  await addIndex("lead_quotes", "idx_leadId", "key", ["leadId"]);
  await addIndex("lead_quotes", "idx_status", "key", ["status"]);
  await addIndex("lead_quotes", "idx_createdAt", "key", ["createdAt"]);

  // Seed default lead automation rules
  console.log("\n--- Seeding Lead Automation Rules ---\n");
  try {
    const { total } = await db.listDocuments(DB_ID, "automation_rules", [Query.limit(1)]);
    if (total === 0) {
      const now = new Date().toISOString();
      const defaultRules = [
        {
          name: "New lead automation",
          enabled: true,
          triggerType: "lead_created",
          actions: JSON.stringify(["classify_lead_category", "create_or_update_contact", "set_pipeline_stage_prospect", "create_setter_call_task", "notify_internal_team"]),
        },
        {
          name: "Prospect automation",
          enabled: true,
          triggerType: "stage_changed_to_prospect",
          pipelineStage: "prospect",
          actions: JSON.stringify(["create_call_task_for_setter", "notify_internal_team"]),
        },
        {
          name: "Opportunity automation",
          enabled: true,
          triggerType: "stage_changed_to_opportunity",
          pipelineStage: "opportunity",
          actions: JSON.stringify(["enrich_lead_summary", "prepare_call_questions", "notify_sales"]),
        },
        {
          name: "Contacted automation",
          enabled: true,
          triggerType: "stage_changed_to_contacted",
          pipelineStage: "contacted",
          actions: JSON.stringify(["save_call_outcome", "summarize_call_notes", "decide_next_stage_if_possible"]),
        },
        {
          name: "Proposal automation",
          enabled: true,
          triggerType: "stage_changed_to_proposal",
          pipelineStage: "proposal",
          actions: JSON.stringify(["generate_quote_draft", "create_quote_record", "notify_founder_admin", "prepare_proposal_email_draft"]),
        },
        {
          name: "Call completed automation",
          enabled: true,
          triggerType: "call_completed",
          actions: JSON.stringify(["save_call_outcome", "route_lead_by_outcome"]),
        },
      ];
      for (const rule of defaultRules) {
        await db.createDocument(DB_ID, "automation_rules", ID.unique(), {
          pipelineStage: null,
          leadCategory: null,
          conditions: null,
          ...rule,
          createdAt: now,
          updatedAt: now,
        });
        console.log(`  Rule "${rule.name}" created`);
      }
    } else {
      console.log("  Automation rules already exist, skipping seed");
    }
  } catch (e: unknown) {
    throw e;
  }

  // =========================================================================
  // CAPTURE & CONVERSION PLATFORM (FASE 2)
  // Landing Pages · Forms · Booking · Funnels · Analytics
  // =========================================================================

  // === LANDING PAGES ===
  await ensureCollection("landing_pages", "Landing Pages");
  await addAttr("landing_pages", str("landing_pages", "name", 255, true));
  await addAttr("landing_pages", str("landing_pages", "slug", 128, true));
  await addAttr("landing_pages", enm("landing_pages", "status", ["draft", "published", "archived"], true, "draft"));
  await addAttr("landing_pages", str("landing_pages", "templateId", 128, false));
  await addAttr("landing_pages", text("landing_pages", "config", true, 65535));
  await addAttr("landing_pages", str("landing_pages", "metaTitle", 255, false));
  await addAttr("landing_pages", str("landing_pages", "metaDescription", 1000, false));
  await addAttr("landing_pages", str("landing_pages", "faviconUrl", 2048, false));
  await addAttr("landing_pages", str("landing_pages", "ogImageUrl", 2048, false));
  await addAttr("landing_pages", int("landing_pages", "views", true, 0));
  await addAttr("landing_pages", int("landing_pages", "submissions", true, 0));
  await addAttr("landing_pages", str("landing_pages", "createdBy", 128, false));
  await addAttr("landing_pages", dt("landing_pages", "createdAt", true));
  await addAttr("landing_pages", dt("landing_pages", "updatedAt", true));
  await addIndex("landing_pages", "idx_slug_unique", "unique", ["slug"]);
  await addIndex("landing_pages", "idx_status", "key", ["status"]);
  await addIndex("landing_pages", "idx_createdAt", "key", ["createdAt"]);

  // === LANDING TEMPLATES ===
  await ensureCollection("landing_templates", "Landing Templates");
  await addAttr("landing_templates", str("landing_templates", "name", 255, true));
  await addAttr("landing_templates", enm("landing_templates", "category", ["blank", "saas", "local_business", "event", "lead_gen"], true, "blank"));
  await addAttr("landing_templates", text("landing_templates", "config", true, 65535));
  await addAttr("landing_templates", str("landing_templates", "thumbnailUrl", 2048, false));
  await addAttr("landing_templates", dt("landing_templates", "createdAt", true));
  await addIndex("landing_templates", "idx_category", "key", ["category"]);

  console.log("\n--- Seeding Landing Templates ---\n");
  const landingTemplateCount = await db.listDocuments(DB_ID, "landing_templates", [Query.limit(1)]);
  if (landingTemplateCount.total === 0) {
    const createdAt = new Date().toISOString();
    const defaultLandingTemplates = [
      {
        name: "Lead generation",
        category: "lead_gen",
        config: JSON.stringify({
          blocks: [
            { id: "tpl_lead_hero", type: "hero", heading: "Ottieni una consulenza gratuita", subheading: "Lasciaci i tuoi dati: ti ricontatteremo con una proposta su misura.", buttonText: "Richiedi informazioni", buttonUrl: "#form", align: "center", backgroundColor: "#0f172a", textColor: "#ffffff" },
            { id: "tpl_lead_features", type: "features", heading: "Perché parlarne con noi", items: [{ title: "Rapido", description: "Risposta concreta in tempi brevi.", icon: "Zap" }, { title: "Su misura", description: "Analisi basata sulle tue esigenze.", icon: "Sparkles" }, { title: "Trasparente", description: "Nessun costo nascosto.", icon: "ShieldCheck" }] },
            { id: "tpl_lead_form", type: "form", formId: null, heading: "Parliamo del tuo progetto" },
            { id: "tpl_lead_footer", type: "footer", text: `© ${new Date().getFullYear()} La tua azienda. Tutti i diritti riservati.` },
          ],
          theme: { primaryColor: "#2563eb", fontFamily: "Inter, sans-serif", maxWidth: 1100 },
        }),
        thumbnailUrl: null,
        createdAt,
      },
      {
        name: "Attività locale",
        category: "local_business",
        config: JSON.stringify({
          blocks: [
            { id: "tpl_local_hero", type: "hero", heading: "Il servizio giusto, vicino a te", subheading: "Prenota un contatto e scopri come possiamo aiutarti.", buttonText: "Contattaci", buttonUrl: "#form", align: "center", backgroundColor: "#14532d", textColor: "#ffffff" },
            { id: "tpl_local_testimonials", type: "testimonials", heading: "Cosa dicono i clienti", items: [{ quote: "Servizio professionale e risposta velocissima.", author: "Cliente verificato", role: "Cliente" }] },
            { id: "tpl_local_form", type: "form", formId: null, heading: "Richiedi informazioni" },
            { id: "tpl_local_footer", type: "footer", text: `© ${new Date().getFullYear()} La tua attività. Tutti i diritti riservati.` },
          ],
          theme: { primaryColor: "#16a34a", fontFamily: "Inter, sans-serif", maxWidth: 1100 },
        }),
        thumbnailUrl: null,
        createdAt,
      },
      {
        name: "Evento",
        category: "event",
        config: JSON.stringify({
          blocks: [
            { id: "tpl_event_hero", type: "hero", heading: "Partecipa al nostro prossimo evento", subheading: "Registrati ora per ricevere tutti i dettagli.", buttonText: "Registrati", buttonUrl: "#form", align: "center", backgroundColor: "#4c1d95", textColor: "#ffffff" },
            { id: "tpl_event_text", type: "text", content: "Un appuntamento pratico pensato per darti strumenti, idee e contatti utili.", align: "center" },
            { id: "tpl_event_form", type: "form", formId: null, heading: "Riserva il tuo posto" },
            { id: "tpl_event_footer", type: "footer", text: `© ${new Date().getFullYear()} La tua azienda. Tutti i diritti riservati.` },
          ],
          theme: { primaryColor: "#7c3aed", fontFamily: "Inter, sans-serif", maxWidth: 1100 },
        }),
        thumbnailUrl: null,
        createdAt,
      },
    ];
    for (const template of defaultLandingTemplates) {
      await db.createDocument(DB_ID, "landing_templates", ID.unique(), template);
      console.log(`  Landing template "${template.name}" created`);
    }
  } else {
    console.log("  Landing templates already exist, skipping seed");
  }

  // === FORMS ===
  await ensureCollection("forms", "Forms");
  await addAttr("forms", str("forms", "name", 255, true));
  await addAttr("forms", str("forms", "description", 1000, false));
  await addAttr("forms", text("forms", "fields", true, 65535));
  await addAttr("forms", text("forms", "style", true, 16384));
  await addAttr("forms", str("forms", "successMessage", 1000, false));
  await addAttr("forms", str("forms", "redirectUrl", 2048, false));
  await addAttr("forms", bool("forms", "embedEnabled", true, true));
  await addAttr("forms", enm("forms", "status", ["draft", "active", "archived"], true, "draft"));
  await addAttr("forms", int("forms", "views", true, 0));
  await addAttr("forms", int("forms", "submissions", true, 0));
  await addAttr("forms", str("forms", "createdBy", 128, false));
  await addAttr("forms", dt("forms", "createdAt", true));
  await addAttr("forms", dt("forms", "updatedAt", true));
  await addIndex("forms", "idx_status", "key", ["status"]);
  await addIndex("forms", "idx_createdAt", "key", ["createdAt"]);

  // === FORM SUBMISSIONS ===
  await ensureCollection("form_submissions", "Form Submissions");
  await addAttr("form_submissions", str("form_submissions", "formId", 128, true));
  await addAttr("form_submissions", str("form_submissions", "landingPageId", 128, false));
  await addAttr("form_submissions", str("form_submissions", "funnelId", 128, false));
  await addAttr("form_submissions", str("form_submissions", "contactId", 128, false));
  await addAttr("form_submissions", text("form_submissions", "data", true, 65535));
  await addAttr("form_submissions", str("form_submissions", "ipHash", 64, false));
  await addAttr("form_submissions", str("form_submissions", "userAgent", 512, false));
  await addAttr("form_submissions", str("form_submissions", "referrer", 2048, false));
  await addAttr("form_submissions", dt("form_submissions", "createdAt", true));
  await addIndex("form_submissions", "idx_formId", "key", ["formId"]);
  await addIndex("form_submissions", "idx_contactId", "key", ["contactId"]);
  await addIndex("form_submissions", "idx_createdAt", "key", ["createdAt"]);

  // === BOOKING LINKS ===
  await ensureCollection("booking_links", "Booking Links");
  await addAttr("booking_links", str("booking_links", "name", 255, true));
  await addAttr("booking_links", str("booking_links", "slug", 128, true));
  await addAttr("booking_links", str("booking_links", "assignedTo", 255, true));
  await addAttr("booking_links", int("booking_links", "durationMinutes", true, 30));
  await addAttr("booking_links", text("booking_links", "availability", true, 16384));
  await addAttr("booking_links", str("booking_links", "successMessage", 1000, false));
  await addAttr("booking_links", str("booking_links", "redirectUrl", 2048, false));
  await addAttr("booking_links", enm("booking_links", "status", ["active", "paused", "archived"], true, "active"));
  await addAttr("booking_links", int("booking_links", "bookingsCount", true, 0));
  await addAttr("booking_links", str("booking_links", "createdBy", 128, false));
  await addAttr("booking_links", dt("booking_links", "createdAt", true));
  await addAttr("booking_links", dt("booking_links", "updatedAt", true));
  await addIndex("booking_links", "idx_slug_unique", "unique", ["slug"]);
  await addIndex("booking_links", "idx_status", "key", ["status"]);
  await addIndex("booking_links", "idx_createdAt", "key", ["createdAt"]);

  // === BOOKING APPOINTMENTS ===
  await ensureCollection("booking_appointments", "Booking Appointments");
  await addAttr("booking_appointments", str("booking_appointments", "bookingLinkId", 128, true));
  await addAttr("booking_appointments", str("booking_appointments", "calendarEventId", 128, false));
  await addAttr("booking_appointments", str("booking_appointments", "contactId", 128, false));
  await addAttr("booking_appointments", str("booking_appointments", "guestName", 255, true));
  await addAttr("booking_appointments", email("booking_appointments", "guestEmail", true));
  await addAttr("booking_appointments", str("booking_appointments", "guestPhone", 50, false));
  await addAttr("booking_appointments", text("booking_appointments", "guestNotes", false));
  await addAttr("booking_appointments", dt("booking_appointments", "startAt", true));
  await addAttr("booking_appointments", dt("booking_appointments", "endAt", true));
  await addAttr("booking_appointments", enm("booking_appointments", "status", ["confirmed", "pending", "cancelled", "completed"], true, "confirmed"));
  await addAttr("booking_appointments", dt("booking_appointments", "createdAt", true));
  await addIndex("booking_appointments", "idx_bookingLinkId", "key", ["bookingLinkId"]);
  await addIndex("booking_appointments", "idx_startAt", "key", ["startAt"]);
  await addIndex("booking_appointments", "idx_createdAt", "key", ["createdAt"]);

  // === FUNNELS ===
  await ensureCollection("funnels", "Funnels");
  await addAttr("funnels", str("funnels", "name", 255, true));
  await addAttr("funnels", str("funnels", "slug", 128, true));
  await addAttr("funnels", text("funnels", "steps", true, 65535));
  await addAttr("funnels", str("funnels", "thankYouPageId", 128, false));
  await addAttr("funnels", enm("funnels", "status", ["draft", "active", "archived"], true, "draft"));
  await addAttr("funnels", int("funnels", "views", true, 0));
  await addAttr("funnels", int("funnels", "conversions", true, 0));
  await addAttr("funnels", str("funnels", "createdBy", 128, false));
  await addAttr("funnels", dt("funnels", "createdAt", true));
  await addAttr("funnels", dt("funnels", "updatedAt", true));
  await addIndex("funnels", "idx_slug_unique", "unique", ["slug"]);
  await addIndex("funnels", "idx_status", "key", ["status"]);
  await addIndex("funnels", "idx_createdAt", "key", ["createdAt"]);

  // === FUNNEL SESSIONS ===
  await ensureCollection("funnel_sessions", "Funnel Sessions");
  await addAttr("funnel_sessions", str("funnel_sessions", "funnelId", 128, true));
  await addAttr("funnel_sessions", str("funnel_sessions", "sessionId", 128, true));
  await addAttr("funnel_sessions", str("funnel_sessions", "contactId", 128, false));
  await addAttr("funnel_sessions", str("funnel_sessions", "currentStep", 128, false));
  await addAttr("funnel_sessions", bool("funnel_sessions", "completed", true, false));
  await addAttr("funnel_sessions", bool("funnel_sessions", "abandoned", true, false));
  await addAttr("funnel_sessions", dt("funnel_sessions", "startedAt", true));
  await addAttr("funnel_sessions", dt("funnel_sessions", "completedAt", false));
  await addIndex("funnel_sessions", "idx_funnelId", "key", ["funnelId"]);
  await addIndex("funnel_sessions", "idx_sessionId", "key", ["sessionId"]);

  // === FUNNEL EVENTS ===
  await ensureCollection("funnel_events", "Funnel Events");
  await addAttr("funnel_events", str("funnel_events", "funnelId", 128, true));
  await addAttr("funnel_events", str("funnel_events", "sessionId", 128, true));
  await addAttr("funnel_events", str("funnel_events", "stepId", 128, true));
  await addAttr("funnel_events", enm("funnel_events", "eventType", ["step_view", "step_submit", "step_skip", "funnel_complete", "funnel_abandon"], true, "step_view"));
  await addAttr("funnel_events", text("funnel_events", "data", false));
  await addAttr("funnel_events", dt("funnel_events", "createdAt", true));
  await addIndex("funnel_events", "idx_funnelId", "key", ["funnelId"]);
  await addIndex("funnel_events", "idx_createdAt", "key", ["createdAt"]);

  // === ANALYTICS EVENTS ===
  await ensureCollection("analytics_events", "Analytics Events");
  await addAttr("analytics_events", enm("analytics_events", "eventType", ["page_view", "cta_click", "scroll_50", "scroll_90", "form_view", "form_start", "form_submit", "form_field_error", "booking_page_view", "slot_select", "booking_submit", "booking_confirm", "booking_complete", "funnel_start", "step_view", "step_submit", "funnel_complete", "funnel_abandon", "funnel_step"], true, "page_view"));
  await addAttr("analytics_events", enm("analytics_events", "assetType", ["landing", "form", "booking", "funnel"], true, "landing"));
  await addAttr("analytics_events", str("analytics_events", "assetId", 128, true));
  await addAttr("analytics_events", str("analytics_events", "sessionId", 128, false));
  await addAttr("analytics_events", str("analytics_events", "ipHash", 64, false));
  await addAttr("analytics_events", str("analytics_events", "userAgent", 512, false));
  await addAttr("analytics_events", str("analytics_events", "referrer", 2048, false));
  await addAttr("analytics_events", dt("analytics_events", "createdAt", true));
  await addIndex("analytics_events", "idx_assetType", "key", ["assetType"]);
  await addIndex("analytics_events", "idx_assetId", "key", ["assetId"]);
  await addIndex("analytics_events", "idx_createdAt", "key", ["createdAt"]);

  // =========================================================================
  // VISUAL WORKFLOW BUILDER (FASE 3)
  // =========================================================================

  // === WORKFLOWS ===
  await ensureCollection("workflows", "Workflows");
  await addAttr("workflows", str("workflows", "name", 255, true));
  await addAttr("workflows", text("workflows", "description", false));
  await addAttr("workflows", enm("workflows", "status", ["draft", "active", "paused", "archived"], true, "draft"));
  await addAttr("workflows", str("workflows", "triggerType", 64, true));
  await addAttr("workflows", text("workflows", "triggerConfig", true, 16384));
  await addAttr("workflows", text("workflows", "nodes", true, 65535));
  await addAttr("workflows", text("workflows", "edges", true, 65535));
  await addAttr("workflows", str("workflows", "createdBy", 128, false));
  await addAttr("workflows", dt("workflows", "createdAt", true));
  await addAttr("workflows", dt("workflows", "updatedAt", true));
  await addIndex("workflows", "idx_status", "key", ["status"]);
  await addIndex("workflows", "idx_triggerType", "key", ["triggerType"]);
  await addIndex("workflows", "idx_createdAt", "key", ["createdAt"]);

  // === WORKFLOW RUNS ===
  await ensureCollection("workflow_runs", "Workflow Runs");
  await addAttr("workflow_runs", str("workflow_runs", "workflowId", 128, true));
  await addAttr("workflow_runs", str("workflow_runs", "triggerType", 64, true));
  await addAttr("workflow_runs", text("workflow_runs", "triggerPayload", true, 65535));
  await addAttr("workflow_runs", enm("workflow_runs", "status", ["running", "scheduled", "completed", "failed", "cancelled"], true, "running"));
  await addAttr("workflow_runs", dt("workflow_runs", "startedAt", true));
  await addAttr("workflow_runs", dt("workflow_runs", "completedAt", false));
  await addAttr("workflow_runs", text("workflow_runs", "error", false));
  await addAttr("workflow_runs", dt("workflow_runs", "createdAt", true));
  await addIndex("workflow_runs", "idx_workflowId", "key", ["workflowId"]);
  await addIndex("workflow_runs", "idx_status", "key", ["status"]);
  await addIndex("workflow_runs", "idx_createdAt", "key", ["createdAt"]);

  // === WORKFLOW RUN LOGS ===
  await ensureCollection("workflow_run_logs", "Workflow Run Logs");
  await addAttr("workflow_run_logs", str("workflow_run_logs", "runId", 128, true));
  await addAttr("workflow_run_logs", str("workflow_run_logs", "nodeId", 128, true));
  await addAttr("workflow_run_logs", str("workflow_run_logs", "nodeType", 64, true));
  await addAttr("workflow_run_logs", enm("workflow_run_logs", "status", ["ok", "skipped", "failed", "pending"], true, "pending"));
  await addAttr("workflow_run_logs", text("workflow_run_logs", "input", false, 65535));
  await addAttr("workflow_run_logs", text("workflow_run_logs", "output", false, 65535));
  await addAttr("workflow_run_logs", text("workflow_run_logs", "error", false));
  await addAttr("workflow_run_logs", dt("workflow_run_logs", "executedAt", true));
  await addIndex("workflow_run_logs", "idx_runId", "key", ["runId"]);
  await addIndex("workflow_run_logs", "idx_executedAt", "key", ["executedAt"]);

  // === WORKFLOW SCHEDULED ===
  await ensureCollection("workflow_scheduled", "Workflow Scheduled");
  await addAttr("workflow_scheduled", str("workflow_scheduled", "workflowId", 128, true));
  await addAttr("workflow_scheduled", str("workflow_scheduled", "runId", 128, true));
  await addAttr("workflow_scheduled", str("workflow_scheduled", "nodeId", 128, true));
  await addAttr("workflow_scheduled", dt("workflow_scheduled", "executeAt", true));
  await addAttr("workflow_scheduled", text("workflow_scheduled", "payload", true, 65535));
  await addAttr("workflow_scheduled", enm("workflow_scheduled", "status", ["pending", "processing", "completed", "cancelled"], true, "pending"));
  await addAttr("workflow_scheduled", dt("workflow_scheduled", "createdAt", true));
  await addIndex("workflow_scheduled", "idx_status_executeAt", "key", ["status", "executeAt"]);
  await addIndex("workflow_scheduled", "idx_workflowId", "key", ["workflowId"]);

  // === STORAGE BUCKET ===
  console.log("\n--- Creating Storage Bucket ---\n");
  try {
    await withRetry('create bucket "uploads"', () => storage.createBucket(
      "uploads",
      "Uploads",
      [],
      true,   // fileSecurity
      true,   // enabled
      20 * 1024 * 1024, // 20MB
      ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "xls", "xlsx", "txt", "mp4", "mov"],
      undefined,
      true,   // encryption
      true    // antivirus
    ));
    console.log('  Bucket "uploads" created');
  } catch (e: unknown) {
    if (e instanceof Error && (e.message.includes("already exists") || e.message.includes("Duplicate"))) {
      console.log('  Bucket "uploads" already exists');
    } else {
      throw e;
    }
  }

  console.log("\nSetup complete!");
}

main().catch((e) => {
  console.error("Setup failed:", e);
  process.exit(1);
});
