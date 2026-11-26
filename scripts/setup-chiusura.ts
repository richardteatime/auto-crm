/**
 * Closing info on deals and opportunities (additive, idempotent):
 *   closedReason (str 500), closedBy (str 128), closedAt (datetime)
 * on collections `opportunities` and `deals`.
 * Run BEFORE deploying the version that closes with a reason:
 *   npx tsx --env-file=.env.local scripts/setup-chiusura.ts   (uses APPWRITE_DATABASE_ID)
 */
import { Client, Databases, Query } from "node-appwrite";

const db = new Databases(
  new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "")
    .setProject(process.env.APPWRITE_PROJECT_ID || "")
    .setKey(process.env.APPWRITE_API_KEY || "")
);
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

async function waitAttributes(col: string) {
  for (let i = 0; i < 90; i++) {
    const res = await db.listAttributes(DB_ID, col, [Query.limit(500)]);
    const attrs = res.attributes as Array<{ status: string }>;
    if (attrs.every((a) => a.status === "available")) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`attributes of ${col} not available in time`);
}

async function main() {
  for (const col of ["opportunities", "deals"]) {
    console.log(`\n${col}`);
    const have = new Set(
      ((await db.listAttributes(DB_ID, col, [Query.limit(500)])).attributes as Array<{ key: string }>).map((x) => x.key)
    );
    if (!have.has("closedReason")) { await db.createStringAttribute(DB_ID, col, "closedReason", 500, false); console.log("  + closedReason"); }
    if (!have.has("closedBy")) { await db.createStringAttribute(DB_ID, col, "closedBy", 128, false); console.log("  + closedBy"); }
    if (!have.has("closedAt")) { await db.createDatetimeAttribute(DB_ID, col, "closedAt", false); console.log("  + closedAt"); }
    await waitAttributes(col);
  }
  console.log("\nfatto");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
