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
// Instead of polluting globalThis.fetch (which intercepts OpenAI, Telegram,
// Resend, etc.), we patch the Client *instance* call() method so the scope
// is strictly limited to Appwrite requests.
// ---------------------------------------------------------------------------
function patchClientForV17Compat(client: Client) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalCall = (client as any).call.bind(client);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).call = async function (
    method: string,
    url: URL,
    headers: Record<string, string> = {},
    params: Record<string, unknown> = {},
    responseType = "json",
  ) {
    const h = { ...headers };
    delete h["x-appwrite-response-format"];
    delete h["x-appwrite-version"];
    return originalCall(method, url, h, params, responseType);
  };
}

function createServerClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  patchClientForV17Compat(client);
  return client;
}

const client = createServerClient();
export const databases = new Databases(client);
export const users = new Users(client);
export const storage = new Storage(client);
