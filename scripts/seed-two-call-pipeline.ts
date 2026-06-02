/**
 * Configura il funnel a 2 call (setter "Cugina di Rick" → closer "Leo") sul
 * backend Appwrite reale, così è subito testabile:
 *
 *   1. Regola `lead_created`            → la PRIMA call (a freddo) va a Cugina
 *      (create_leo_call_task → create_setter_call_task).
 *   2. Regola `stage_changed_to_prospect` → idem (Cugina, non Leo).
 *   3. Verifica il booking link di Leo (/book/<LEO_BOOKING_SLUG>) per la call 2.
 *   4. Riduce il workflow `form_submitted` a sola "notifica team" (niente più
 *      email a Leo / link al cliente: ora il primo contatto è Cugina via pipeline).
 *
 * Idempotente. Uso (dalla cartella auto-crm):  npx tsx scripts/seed-two-call-pipeline.ts
 */
import { Client, Databases, Query } from "node-appwrite";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

const SETTER_NAME = process.env.CUGINA_NAME || "Cugina di Rick";
const SETTER_EMAIL = process.env.CUGINA_EMAIL || process.env.LEAD_NOTIFY_EMAIL || "(non configurata)";
const LEO_BOOKING_SLUG = process.env.LEO_BOOKING_SLUG || "call-leo";

type Node = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { nodeType: string; label: string; config: Record<string, unknown> };
};
type Edge = { id: string; source: string; target: string; type?: string };

function parse<T>(raw: unknown, fallback: T): T {
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

async function setRuleActions(
  db: Databases,
  triggerType: string,
  actions: string[],
): Promise<void> {
  const res = await db.listDocuments(DB_ID, "automation_rules", [
    Query.equal("triggerType", triggerType),
    Query.limit(10),
  ]);
  if (res.total === 0) {
    console.log(`  ⚠ nessuna regola "${triggerType}" trovata (lancia npm run setup)`);
    return;
  }
  for (const r of res.documents) {
    await db.updateDocument(DB_ID, "automation_rules", r.$id, {
      actions: JSON.stringify(actions),
      updatedAt: new Date().toISOString(),
    });
    console.log(`  ✓ ${triggerType}: ${actions.join(", ")}`);
  }
}

async function main() {
  if (!PROJECT || !API_KEY) throw new Error("Mancano APPWRITE_PROJECT_ID / APPWRITE_API_KEY in .env.local");
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const db = new Databases(client);

  console.log(`Setter: ${SETTER_NAME} <${SETTER_EMAIL}>  ·  Closer booking: /book/${LEO_BOOKING_SLUG}\n`);

  // 1) + 2) Regole: la prima call va alla setter (Cugina).
  console.log("Regole automazione:");
  await setRuleActions(db, "lead_created", [
    "classify_lead_category",
    "create_or_update_contact",
    "set_pipeline_stage_prospect",
    "create_setter_call_task",
    "notify_internal_team",
  ]);
  await setRuleActions(db, "stage_changed_to_prospect", [
    "create_call_task_for_setter",
    "notify_internal_team",
  ]);

  // 3) Booking link di Leo (call 2).
  const bl = await db.listDocuments(DB_ID, "booking_links", [
    Query.equal("slug", LEO_BOOKING_SLUG),
    Query.limit(1),
  ]);
  console.log("\nBooking link closer:");
  if (bl.total) {
    console.log(`  ✓ /book/${LEO_BOOKING_SLUG} presente (id ${bl.documents[0].$id})`);
  } else {
    console.log(`  ⚠ /book/${LEO_BOOKING_SLUG} NON trovato → lancia: npx tsx scripts/seed-call-funnel.ts`);
  }

  // 4) Riduci il workflow form_submitted a sola notifica interna.
  console.log("\nWorkflow form_submitted:");
  const wfs = await db.listDocuments(DB_ID, "workflows", [
    Query.equal("triggerType", "form_submitted"),
    Query.equal("status", "active"),
    Query.limit(10),
  ]);
  if (wfs.total === 0) console.log("  (nessun workflow form_submitted attivo)");
  for (const w of wfs.documents) {
    const nodes = parse<Node[]>(w.nodes, []);
    const trigger = nodes.find((n) => n.type === "trigger");
    if (!trigger) {
      console.log(`  ⚠ "${w.name}" senza trigger — saltato`);
      continue;
    }
    const existingNotify = nodes.find(
      (n) => n.type === "action" && n.data?.nodeType === "send_internal_message",
    );
    const notify: Node = existingNotify
      ? { ...existingNotify, position: { x: trigger.position.x, y: trigger.position.y + 150 } }
      : {
          id: `n_notify_${Date.now()}`,
          type: "action",
          position: { x: trigger.position.x, y: trigger.position.y + 150 },
          data: {
            nodeType: "send_internal_message",
            label: "Notifica team",
            config: {
              userId: process.env.LEO_USER_ID || "leo",
              message: "Nuovo lead dal form: {{trigger.payload.name}} ({{trigger.payload.email}})",
            },
          },
        };
    const newNodes = [trigger, notify];
    const newEdges: Edge[] = [
      { id: `e_${trigger.id}_${notify.id}`, source: trigger.id, target: notify.id, type: "smoothstep" },
    ];
    await db.updateDocument(DB_ID, "workflows", w.$id, {
      name: "Lead dal form → notifica team",
      description:
        "Notifica interna all'arrivo di un lead dal form. La logica delle 2 call " +
        "(Cugina scrematura → Leo chiusura) vive nella pipeline lead, non qui.",
      nodes: JSON.stringify(newNodes),
      edges: JSON.stringify(newEdges),
      updatedAt: new Date().toISOString(),
    });
    console.log(`  ✓ "${w.name}" ridotto a sola notifica team`);
  }

  console.log("\nFatto. Funnel a 2 call configurato e pronto al test.");
  console.log("Flusso: form → call task a Cugina → 'Passa a Leo → prenota' → call di chiusura Leo.");
}

main().catch((e) => {
  console.error("Errore seed-two-call-pipeline:", e);
  process.exit(1);
});
