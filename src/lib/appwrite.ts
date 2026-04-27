import { Client, Databases, Users } from "node-appwrite";

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
  tasks: "tasks",
  messages: "messages",
  expenses: "expenses",
  quotes: "quotes",
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
