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
  } catch (error: unknown) {
    const details =
      typeof error === "object" && error !== null
        ? (error as { code?: unknown; message?: unknown; type?: unknown })
        : {};
    const message =
      typeof details.message === "string" ? details.message : String(error);
    if (message.includes("not found") || details.code === 404 || details.type === "database_not_found") {
      await db.create(process.env.APPWRITE_DATABASE_ID!, process.env.APPWRITE_DATABASE_ID!);
      console.log("Database created");
    } else {
      console.error("Error:", message);
      process.exit(1);
    }
  }
}

main();
