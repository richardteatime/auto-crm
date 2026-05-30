import { Client, Databases } from "node-appwrite";
import { config } from "dotenv";
config({ path: ".env.local" });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);

async function main() {
  try {
    await db.get(process.env.APPWRITE_DATABASE_ID!);
    console.log("Database exists");
  } catch (e: any) {
    if (e.message?.includes("not found") || e.code === 404 || e.type === "database_not_found") {
      await db.create(process.env.APPWRITE_DATABASE_ID!, process.env.APPWRITE_DATABASE_ID!);
      console.log("Database created");
    } else {
      console.error("Error:", e.message || e);
      process.exit(1);
    }
  }
}

main();
