import { Client, Users } from "node-appwrite";
import "dotenv/config";

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || email;

if (!email || !password) {
  console.error("Usage: node node_modules/tsx/dist/cli.mjs scripts/seed-user.ts <email> <password> [name]");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const users = new Users(client);

try {
  const { $id } = await users.create("unique()", email, password, name);
  console.log(`User created: id=${$id}, email=${email}, name=${name}`);
} catch (e: unknown) {
  console.error("Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
}
