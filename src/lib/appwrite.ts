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
