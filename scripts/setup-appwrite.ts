import { Client, Databases, ID, Query, Storage } from "node-appwrite";

// node-appwrite v17 uses string literals for index types
type IndexType = "key" | "unique" | "fulltext";
import { config } from "dotenv";
config({ path: ".env.local" });

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
  const storage = new Storage(client);

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
  async function addIndex(collectionId: string, key: string, type: IndexType, attrs: string[]) {
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
  await addAttr("workflow_events", str("workflow_events", "runId", 128, true));
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
    console.error("  Policy seed error:", e instanceof Error ? e.message : e);
  }

  // === STORAGE BUCKET ===
  console.log("\n--- Creating Storage Bucket ---\n");
  try {
    await storage.createBucket(
      "uploads",
      "Uploads",
      [],
      true,   // fileSecurity
      true,   // enabled
      undefined,
      undefined,
      undefined,
      20 * 1024 * 1024, // 20MB
      ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "xls", "xlsx", "txt", "mp4", "mov"],
      undefined,
      true,   // encryption
      true    // antivirus
    );
    console.log('  Bucket "uploads" created');
  } catch (e: unknown) {
    if (e instanceof Error && (e.message.includes("already exists") || e.message.includes("Duplicate"))) {
      console.log('  Bucket "uploads" already exists');
    } else {
      console.error('  Bucket error:', e instanceof Error ? e.message : e);
    }
  }

  console.log("\nSetup complete!");
}

main().catch((e) => {
  console.error("Setup failed:", e);
  process.exit(1);
});
