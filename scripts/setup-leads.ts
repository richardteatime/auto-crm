/**
 * Lead section schema (additive, idempotent): collections `leads`, `lead_events`, `push_subscriptions`.
 * Run: npx tsx --env-file=.env.local scripts/setup-leads.ts   (uses APPWRITE_DATABASE_ID)
 */
import { Client, Databases, IndexType } from "node-appwrite";

const db = new Databases(
  new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "")
    .setProject(process.env.APPWRITE_PROJECT_ID || "")
    .setKey(process.env.APPWRITE_API_KEY || "")
);
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

const exists = (e: unknown) =>
  e instanceof Error && /already exists|Duplicate|409/i.test(e.message);

async function safe(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`  + ${label}`);
  } catch (e) {
    if (exists(e)) return;
    console.error(`  ! ${label}:`, e instanceof Error ? e.message : e);
    throw e;
  }
}

async function waitAttributes(col: string) {
  for (let i = 0; i < 90; i++) {
    const res = await db.listAttributes(DB_ID, col);
    const attrs = res.attributes as Array<{ status: string }>;
    if (attrs.every((a) => a.status === "available")) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`attributes of ${col} not available in time`);
}

type Attr =
  | ["str", string, number, boolean?, string?]
  | ["int", string, boolean?, number?]
  | ["dt", string, boolean?];

async function collection(id: string, name: string, attrs: Attr[], indexes: Array<[string, IndexType, string[]]>) {
  console.log(`\n${id}`);
  await safe(`collection ${id}`, () => db.createCollection(DB_ID, id, name));
  for (const a of attrs) {
    if (a[0] === "str") {
      const [, key, size, req = false, def] = a;
      await safe(key, () => db.createStringAttribute(DB_ID, id, key, size, def !== undefined ? false : req, def));
    } else if (a[0] === "int") {
      const [, key, req = false, def] = a;
      await safe(key, () => db.createIntegerAttribute(DB_ID, id, key, def !== undefined ? false : req, 0, undefined, def));
    } else {
      const [, key, req = false] = a;
      await safe(key, () => db.createDatetimeAttribute(DB_ID, id, key, req));
    }
  }
  await waitAttributes(id);
  for (const [key, type, cols] of indexes) {
    await safe(`index ${key}`, () => db.createIndex(DB_ID, id, key, type, cols));
  }
}

async function main() {
  console.log(`DB: ${DB_ID}`);

  await collection(
    "leads",
    "Leads",
    [
      ["str", "externalId", 128, true],
      ["str", "name", 255, true],
      ["str", "phone", 64],
      ["str", "phoneE164", 32],
      ["str", "email", 255],
      ["str", "company", 255],
      ["str", "service", 255],
      ["str", "formData", 16384],
      ["str", "source", 32, false, "meta_form"],
      ["str", "campaign", 255],
      ["str", "adset", 255],
      ["str", "ad", 255],
      ["str", "formName", 255],
      ["str", "platform", 32],
      ["str", "status", 32, false, "nuovo"],
      ["str", "lostReason", 255],
      ["dt", "nextActionAt"],
      ["str", "nextActionNote", 1024],
      ["str", "assignedTo", 64],
      ["dt", "firstContactAt"],
      ["dt", "lastContactAt"],
      ["int", "callAttempts", false, 0],
      ["str", "notes", 8192],
      ["int", "value"],
      ["str", "contactId", 64],
      ["str", "dealId", 64],
      ["dt", "escalatedAt"],
      ["dt", "remindedAt"],
      ["str", "crmInstance", 32],
      ["str", "dealCrm", 32],
    ],
    [
      ["leads_external_id", IndexType.Unique, ["externalId"]],
      ["leads_status", IndexType.Key, ["status"]],
      ["leads_next_action", IndexType.Key, ["nextActionAt"]],
      ["leads_phone", IndexType.Key, ["phoneE164"]],
    ]
  );

  await collection(
    "lead_events",
    "Lead events",
    [
      ["str", "leadId", 64, true],
      ["str", "type", 32, true],
      ["str", "outcome", 32],
      ["str", "fromStatus", 32],
      ["str", "toStatus", 32],
      ["str", "note", 4096],
      ["str", "actorId", 64],
      ["str", "actorName", 128],
    ],
    [["lead_events_lead", IndexType.Key, ["leadId"]]]
  );

  await collection(
    "push_subscriptions",
    "Push subscriptions",
    [
      ["str", "userId", 64, true],
      ["str", "endpointHash", 64, true],
      ["str", "endpoint", 2048, true],
      ["str", "p256dh", 256, true],
      ["str", "auth", 128, true],
      ["str", "userAgent", 255],
    ],
    [
      ["push_endpoint", IndexType.Unique, ["endpointHash"]],
      ["push_user", IndexType.Key, ["userId"]],
    ]
  );

  console.log("\nok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
