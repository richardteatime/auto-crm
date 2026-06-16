import { Client, Databases, Users, Query } from "node-appwrite";
import { config } from "dotenv";

config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const projectId = process.env.APPWRITE_PROJECT_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const dbId = process.env.APPWRITE_DATABASE_ID || "crm";

function getAdminClient() {
  return new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
}

const databases = new Databases(getAdminClient());
const users = new Users(getAdminClient());

export async function cleanupTestContacts(): Promise<void> {
  try {
    const res = await databases.listDocuments(dbId, "contacts", [
      Query.startsWith("name", "Test"),
      Query.limit(100),
    ]);
    for (const doc of res.documents) {
      await databases.deleteDocument(dbId, "contacts", doc.$id);
    }
  } catch (error: unknown) {
    console.error(
      "cleanupTestContacts failed:",
      error instanceof Error ? error.message : error
    );
  }
}

export async function cleanupTestDeals(): Promise<void> {
  try {
    const res = await databases.listDocuments(dbId, "deals", [
      Query.startsWith("title", "Test"),
      Query.limit(100),
    ]);
    for (const doc of res.documents) {
      await databases.deleteDocument(dbId, "deals", doc.$id);
    }
  } catch (error: unknown) {
    console.error(
      "cleanupTestDeals failed:",
      error instanceof Error ? error.message : error
    );
  }
}
