/**
 * Pulizia: elimina i workflow in BOZZA (status "draft") con trigger
 * form_submitted — cioè il vecchio duplicato "Lead dal form: notifica team"
 * disattivato dalla fusione. Stampa cosa elimina prima di farlo.
 *
 * Uso (dalla cartella auto-crm):  npx tsx scripts/delete-draft-form-workflow.ts
 */
import { Client, Databases, Query } from "node-appwrite";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

async function main() {
  if (!PROJECT || !API_KEY) throw new Error("Mancano APPWRITE_PROJECT_ID / APPWRITE_API_KEY in .env.local");
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const db = new Databases(client);

  const res = await db.listDocuments(DB_ID, "workflows", [
    Query.equal("triggerType", "form_submitted"),
    Query.equal("status", "draft"),
    Query.limit(25),
  ]);

  if (res.total === 0) {
    console.log("Nessun workflow form_submitted in bozza da eliminare.");
    return;
  }

  for (const w of res.documents) {
    await db.deleteDocument(DB_ID, "workflows", w.$id);
    console.log(`Eliminato: "${w.name}" (id ${w.$id})`);
  }

  console.log(`\nFatto. ${res.total} workflow in bozza eliminato/i.`);
}

main().catch((e) => {
  console.error("Errore delete-draft-form-workflow:", e);
  process.exit(1);
});
