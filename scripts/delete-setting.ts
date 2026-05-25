import { config } from "dotenv";
config({ path: ".env.local" });
import { Client, Databases } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);

async function main() {
  try {
    await db.deleteDocument("crm", "crm_settings", "6a14c04f00292047e1ee");
    console.log("deleted");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

main();
