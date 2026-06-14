import { Client, Databases } from "node-appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const dbId = process.env.APPWRITE_DATABASE_ID || "crm";

if (!endpoint || !projectId || !apiKey) {
  throw new Error(
    "NEXT_PUBLIC_APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID e APPWRITE_API_KEY sono obbligatori",
  );
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const db = new Databases(client);

async function main() {
  try {
    await db.updateStringAttribute(dbId, "quotes", "notes", false, null, 100000);
    console.log("✅ quotes.notes aggiornato a 100000 chars");
  } catch (e: unknown) {
    console.error("❌ Errore quotes.notes:", e instanceof Error ? e.message : e);
  }

  try {
    await db.updateStringAttribute(dbId, "quotes", "items", true, null, 100000);
    console.log("✅ quotes.items aggiornato a 100000 chars");
  } catch (e: unknown) {
    console.error("❌ Errore quotes.items:", e instanceof Error ? e.message : e);
  }
}

main();
