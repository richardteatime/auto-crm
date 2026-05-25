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
    const res = await db.listDocuments("crm", "crm_settings");
    console.log("Total:", res.total);
    (res.documents as any[]).forEach((d: any) => console.log(d.$id, d.key, "=", d.value));
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
