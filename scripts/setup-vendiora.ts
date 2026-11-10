/**
 * Vendiora collections in the leads database (LEADS_DATABASE_ID, default APPWRITE_DATABASE_ID).
 * Strings > 16383 chars become TEXT columns (not counted in the MariaDB row-size limit).
 * Idempotent: creates only what is missing. All attributes optional except the few marked required
 * on brand-new collections (no existing documents to break).
 *
 *   npx tsx --env-file=.env.local scripts/setup-vendiora.ts
 */
import { Client, Databases, IndexType } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "")
  .setProject(process.env.APPWRITE_PROJECT_ID || "")
  .setKey(process.env.APPWRITE_API_KEY || "");
const db = new Databases(client);
const DB = process.env.LEADS_DATABASE_ID || process.env.APPWRITE_DATABASE_ID || "crm";

type Attr =
  | { k: string; t: "s"; size: number; req?: boolean }
  | { k: string; t: "i"; req?: boolean }
  | { k: string; t: "f"; req?: boolean }
  | { k: string; t: "b"; req?: boolean }
  | { k: string; t: "d"; req?: boolean };

const S = (k: string, size = 255, req = false): Attr => ({ k, t: "s", size, req });
const I = (k: string): Attr => ({ k, t: "i" });
const F = (k: string): Attr => ({ k, t: "f" });
const B = (k: string): Attr => ({ k, t: "b" });
const D = (k: string): Attr => ({ k, t: "d" });

const SCHEMA: Record<string, { name: string; attrs: Attr[]; indexes: Array<[string, string[], ("asc" | "desc")?]> }> = {
  vd_packages: {
    name: "Vendiora pacchetti",
    attrs: [S("name", 200, true), S("tagline", 500), S("deliverables", 20000), I("price"), F("vatRate"), I("includedCalls"), I("buildDays"), I("coachingDays"), S("guarantee", 2000), S("paymentTerms", 2000), B("active"), I("sortOrder")],
    indexes: [["idx_sort", ["sortOrder"]]],
  },
  vd_clients: {
    name: "Vendiora clienti",
    attrs: [
      S("leadId", 64), S("name", 255, true), S("email", 255), S("phone", 64), S("phoneE164", 32), S("taxId", 64), S("address", 500),
      S("packageId", 64), S("packageSnapshot", 20000), S("packageName", 200), I("price"), F("vatRate"), S("paymentTerms", 2000),
      S("status", 32), S("contractNumber", 32), D("contractDate"), D("contractSignedAt"), B("isPaid"), D("paidAt"),
      D("kickoffAt"), D("storeLiveAt"), S("storeUrl", 500), S("coach", 120), S("notes", 20000),
    ],
    indexes: [["idx_lead", ["leadId"]], ["idx_contract", ["contractNumber"]], ["idx_status", ["status"]]],
  },
  vd_calls: {
    name: "Vendiora call",
    attrs: [S("clientId", 64, true), S("clientName", 255), I("number"), S("title", 200), S("status", 32), D("scheduledAt"), D("doneAt"), S("notes", 4000)],
    indexes: [["idx_client", ["clientId"]], ["idx_sched", ["scheduledAt"]], ["idx_number", ["number"]]],
  },
  vd_messages: {
    name: "Vendiora WhatsApp messaggi",
    attrs: [S("leadId", 64), S("clientId", 64), S("phoneE164", 32), S("direction", 8, true), S("author", 120), S("text", 4000), S("waId", 128), D("at")],
    indexes: [["idx_lead", ["leadId"]], ["idx_phone", ["phoneE164"]], ["idx_wa", ["waId"]], ["idx_at", ["at"]]],
  },
  vd_conversations: {
    name: "Vendiora bot conversazioni",
    attrs: [S("leadId", 64, true), S("phoneE164", 32), S("chatIds", 1000), S("state", 20), I("step"), S("answers", 20000), D("lastInboundAt"), D("handoffAt")],
    indexes: [["idx_lead", ["leadId"]], ["idx_phone", ["phoneE164"]]],
  },
  vd_settings: { name: "Vendiora impostazioni", attrs: [S("data", 30000)], indexes: [] },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitAttrs(col: string) {
  for (let i = 0; i < 60; i++) {
    const res = await db.listAttributes(DB, col);
    const attrs = res.attributes as unknown as Array<{ status: string }>;
    if (attrs.every((a) => a.status === "available")) return;
    await sleep(1000);
  }
}

async function main() {
  console.log(`DB ${DB}`);
  for (const [id, def] of Object.entries(SCHEMA)) {
    let fresh = false;
    try {
      await db.getCollection(DB, id);
    } catch {
      await db.createCollection(DB, id, def.name);
      fresh = true;
      console.log(`+ collection ${id}`);
    }
    const have = new Set(((await db.listAttributes(DB, id, )).attributes as unknown as Array<{ key: string }>).map((a) => a.key));
    for (const a of def.attrs) {
      if (have.has(a.k)) continue;
      const req = fresh && !!a.req;
      if (a.t === "s") await db.createStringAttribute(DB, id, a.k, a.size, req);
      else if (a.t === "i") await db.createIntegerAttribute(DB, id, a.k, false);
      else if (a.t === "f") await db.createFloatAttribute(DB, id, a.k, false);
      else if (a.t === "b") await db.createBooleanAttribute(DB, id, a.k, false);
      else await db.createDatetimeAttribute(DB, id, a.k, false);
      console.log(`  + ${id}.${a.k}`);
    }
    await waitAttrs(id);
    const idx = new Set(((await db.listIndexes(DB, id)).indexes as unknown as Array<{ key: string }>).map((x) => x.key));
    for (const [key, attrs] of def.indexes) {
      if (idx.has(key)) continue;
      await db.createIndex(DB, id, key, IndexType.Key, attrs);
      console.log(`  + index ${id}.${key}`);
    }
  }
  console.log("ok");
}

main().catch((e) => { console.error(e); process.exit(1); });
