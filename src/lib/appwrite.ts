import { Client, Databases, Users, Storage } from "node-appwrite";

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

export const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

export const COLLECTIONS = {
  contacts: "contacts",
  pipelineStages: "pipeline_stages",
  deals: "deals",
  activities: "activities",
  crmSettings: "crm_settings",
  messages: "messages",
  expenses: "expenses",
  quotes: "quotes",
  opportunities: "opportunities",
  projects: "projects",
  projectLogs: "project_logs",
  notifications: "notifications",
  revenues: "revenues",
  calendarEvents: "calendar_events",
  chatwootMessages: "chatwoot_messages",
  crmOperators: "crm_operators",
  telegramMessages: "telegram_messages",
  telegramOutbox: "telegram_outbox",
  commandConfirmations: "command_confirmations",
  orchestratorRuns: "orchestrator_runs",
  workflowEvents: "workflow_events",
  agentTasks: "agent_tasks",
  projectArtifacts: "project_artifacts",
  deploymentResults: "deployment_results",
  automationPolicies: "automation_policies",
  tasks: "tasks",
  // Lead Pipeline Automation MVP
  leads: "leads",
  pipelineMovements: "pipeline_movements",
  automationRules: "automation_rules",
  automationRuns: "automation_runs",
  callTasks: "call_tasks",
  leadQuotes: "lead_quotes",
  // Capture & Conversion Platform (FASE 2)
  landingPages: "landing_pages",
  landingTemplates: "landing_templates",
  forms: "forms",
  formSubmissions: "form_submissions",
  bookingLinks: "booking_links",
  bookingAppointments: "booking_appointments",
  funnels: "funnels",
  funnelSessions: "funnel_sessions",
  funnelEvents: "funnel_events",
  analyticsEvents: "analytics_events",
  // Visual Workflow Builder (FASE 3)
  workflows: "workflows",
  workflowRuns: "workflow_runs",
  workflowRunLogs: "workflow_run_logs",
  workflowScheduled: "workflow_scheduled",
} as const;

// ---------------------------------------------------------------------------
// Patch: remove SDK v24 headers that Appwrite 1.7.4 doesn't understand.
// SDK v24 sends "x-appwrite-response-format" and serializes queries as
// JSON objects. Appwrite 1.7.4 only accepts the legacy string format.
// ---------------------------------------------------------------------------
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  if (init?.headers) {
    const h = init.headers as Record<string, string>;
    delete h["x-appwrite-response-format"];
    // Also strip x-appwrite-version if present
    delete h["x-appwrite-version"];
  }
  return originalFetch(input, init);
} as typeof globalThis.fetch;

function createServerClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  return client;
}

const client = createServerClient();
export const databases = new Databases(client);
export const users = new Users(client);
export const storage = new Storage(client);
