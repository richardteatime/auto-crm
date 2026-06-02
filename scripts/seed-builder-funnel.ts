/**
 * "Tutto nel builder": rende il funnel a 2 call interamente come WORKFLOW
 * visibili e modificabili dal CRM.
 *
 *   A) "1) Lead dal form → call a freddo (Cugina)"   trigger form_submitted
 *      Form → crea call task Cugina → stato "da chiamare" → email Cugina → notifica team
 *
 *   B) "2) Esito call → instradamento (Cugina/Leo)"  trigger call_outcome_recorded
 *      Ha chiamato Cugina? → qualificato? → passa a Leo (task + fase Opportunità + email)
 *                                          → non interessato? → perso ; altro → follow-up
 *      (No = Leo) → qualificato? → preventivo (fase Proposta) ; altro → follow-up
 *
 * I confronti usano ETICHETTE ITALIANE (corrispondono al menù "Registra esito"):
 * il bridge passa `outcomeLabel` (es. "Qualificato") e `assigneeName` (es.
 * "Cugina di Rick"), così nel builder è tutto leggibile e coerente con gli esiti.
 *
 * Disattiva il routing in codice (regola call_completed → solo save_call_outcome).
 *
 * Idempotente. Uso (da auto-crm):  npx tsx scripts/seed-builder-funnel.ts
 */
import { Client, Databases, ID, Query } from "node-appwrite";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

const SETTER_NAME = process.env.CUGINA_NAME || "Cugina di Rick";
const LEO_ID = process.env.LEO_USER_ID || "leo";
const CUGINA_EMAIL = process.env.CUGINA_EMAIL || process.env.LEAD_NOTIFY_EMAIL || "";
const LEO_EMAIL = process.env.LEO_EMAIL || process.env.LEAD_NOTIFY_EMAIL || "";
const LEO_BOOKING_SLUG = process.env.LEO_BOOKING_SLUG || "call-leo";

// Esiti chiamata = ETICHETTE italiane (= menù "Registra esito"). Il bridge passa
// outcomeLabel; qui confrontiamo le etichette, non i codici interni.
const OUT_POS = "Qualificato,Interessato,Vuole preventivo"; // fanno avanzare
const OUT_NEG = "Non qualificato,Non interessato,Numero errato"; // "perso"

interface WfDef {
  triggerType: string;
  name: string;
  description: string;
  nodes: unknown[];
  edges: unknown[];
}

async function upsertWorkflow(db: Databases, def: WfDef): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    name: def.name,
    description: def.description,
    status: "active",
    triggerType: def.triggerType,
    triggerConfig: "{}",
    nodes: JSON.stringify(def.nodes),
    edges: JSON.stringify(def.edges),
    updatedAt: now,
  };
  const res = await db.listDocuments(DB_ID, "workflows", [
    Query.equal("triggerType", def.triggerType),
    Query.limit(10),
  ]);
  if (res.total > 0) {
    await db.updateDocument(DB_ID, "workflows", res.documents[0].$id, payload);
    console.log(`  ✓ aggiornato "${def.name}" (${res.documents[0].$id})`);
  } else {
    const created = await db.createDocument(DB_ID, "workflows", ID.unique(), {
      ...payload,
      createdBy: null,
      createdAt: now,
    });
    console.log(`  ✓ creato "${def.name}" (${created.$id})`);
  }
}

async function setRuleActions(db: Databases, triggerType: string, actions: string[]): Promise<void> {
  const res = await db.listDocuments(DB_ID, "automation_rules", [
    Query.equal("triggerType", triggerType),
    Query.limit(10),
  ]);
  if (res.total === 0) {
    console.log(`  ⚠ nessuna regola "${triggerType}" (lancia npm run setup)`);
    return;
  }
  for (const r of res.documents) {
    await db.updateDocument(DB_ID, "automation_rules", r.$id, {
      actions: JSON.stringify(actions),
      updatedAt: new Date().toISOString(),
    });
    console.log(`  ✓ regola ${triggerType}: ${actions.join(", ")}`);
  }
}

function buildWorkflowA(): WfDef {
  return {
    triggerType: "form_submitted",
    name: "1) Lead dal form → call a freddo (Cugina)",
    description:
      "All'arrivo di un lead dal form: crea la call task per Cugina (call a freddo), " +
      "mette il lead 'da chiamare', avvisa Cugina via email e notifica il team.",
    nodes: [
      { id: "a_trigger", type: "trigger", position: { x: 320, y: 20 }, data: { nodeType: "form_submitted", label: "Form inviato", config: {} } },
      { id: "a_task", type: "action", position: { x: 320, y: 150 }, data: { nodeType: "create_lead_call_task", label: "Crea call task: Cugina", config: { assignee: "setter", notes: "{{trigger.payload.message}}" } } },
      { id: "a_status", type: "action", position: { x: 320, y: 280 }, data: { nodeType: "set_lead_status", label: "Stato: Da chiamare", config: { status: "to_call" } } },
      { id: "a_email", type: "action", position: { x: 320, y: 410 }, data: { nodeType: "send_email", label: "Email a Cugina", config: { to: CUGINA_EMAIL, subject: "Nuova chiamata a freddo: {{trigger.payload.name}}", body: "<p>Nuovo lead da contattare (scrematura a freddo):</p><ul><li>Nome: {{trigger.payload.name}}</li><li>Email: {{trigger.payload.email}}</li><li>Telefono: {{trigger.payload.phone}}</li><li>Messaggio: {{trigger.payload.message}}</li></ul>" } } },
      { id: "a_notify", type: "action", position: { x: 320, y: 540 }, data: { nodeType: "send_internal_message", label: "Notifica team", config: { userId: LEO_ID, message: "Nuovo lead dal form: {{trigger.payload.name}} ({{trigger.payload.email}})" } } },
    ],
    edges: [
      { id: "a_e1", source: "a_trigger", target: "a_task", type: "smoothstep" },
      { id: "a_e2", source: "a_task", target: "a_status", type: "smoothstep" },
      { id: "a_e3", source: "a_status", target: "a_email", type: "smoothstep" },
      { id: "a_e4", source: "a_email", target: "a_notify", type: "smoothstep" },
    ],
  };
}

function buildWorkflowB(): WfDef {
  return {
    triggerType: "call_outcome_recorded",
    name: "2) Esito call → instradamento (Cugina/Leo)",
    description:
      "Quando si registra l'esito di una chiamata: se l'ha fatta Cugina e ha qualificato → passa a Leo " +
      "(call di chiusura + fase Opportunità); se l'ha fatta Leo e ha qualificato → preventivo (fase Proposta). " +
      "Esiti negativi → perso; gli altri → follow-up. I confronti usano le etichette italiane degli esiti.",
    nodes: [
      { id: "b_trigger", type: "trigger", position: { x: 420, y: 0 }, data: { nodeType: "call_outcome_recorded", label: "Esito chiamata", config: {} } },
      { id: "b_isSetter", type: "condition", position: { x: 420, y: 130 }, data: { nodeType: "if_field_equals", label: "Ha chiamato Cugina?", config: { field: "assigneeName", compareValue: SETTER_NAME } } },
      // --- ramo Cugina (setter) ---
      { id: "b_setterQual", type: "condition", position: { x: 150, y: 270 }, data: { nodeType: "if_field_in", label: "Qualificato?", config: { field: "outcomeLabel", values: OUT_POS } } },
      { id: "b_setQ", type: "action", position: { x: 20, y: 410 }, data: { nodeType: "set_lead_status", label: "Stato: Qualificato", config: { status: "qualified" } } },
      { id: "b_moveOpp", type: "action", position: { x: 20, y: 520 }, data: { nodeType: "move_lead_stage", label: "Fase: Opportunità", config: { stage: "opportunity" } } },
      { id: "b_leoTask", type: "action", position: { x: 20, y: 630 }, data: { nodeType: "create_lead_call_task", label: "Crea call task: Leo", config: { assignee: "closer", notes: "Call di chiusura — lead scremato da Cugina" } } },
      { id: "b_emailLeo", type: "action", position: { x: 20, y: 740 }, data: { nodeType: "send_email", label: "Email a Leo", config: { to: LEO_EMAIL, subject: "Lead caldo da chiudere: {{trigger.payload.name}}", body: "<p>Cugina ha qualificato un lead, pronto per la call di chiusura:</p><ul><li>Nome: {{trigger.payload.name}}</li><li>Email: {{trigger.payload.email}}</li><li>Telefono: {{trigger.payload.phone}}</li></ul>" } } },
      { id: "b_setterLost", type: "condition", position: { x: 300, y: 410 }, data: { nodeType: "if_field_in", label: "Non interessato?", config: { field: "outcomeLabel", values: OUT_NEG } } },
      { id: "b_lost", type: "action", position: { x: 250, y: 560 }, data: { nodeType: "set_lead_status", label: "Stato: Perso", config: { status: "lost" } } },
      { id: "b_working1", type: "action", position: { x: 410, y: 560 }, data: { nodeType: "set_lead_status", label: "Stato: In lavorazione", config: { status: "working" } } },
      // --- ramo Leo (closer) ---
      { id: "b_closerQual", type: "condition", position: { x: 690, y: 270 }, data: { nodeType: "if_field_in", label: "Qualificato?", config: { field: "outcomeLabel", values: OUT_POS } } },
      { id: "b_setQ2", type: "action", position: { x: 630, y: 410 }, data: { nodeType: "set_lead_status", label: "Stato: Qualificato", config: { status: "qualified" } } },
      { id: "b_moveProp", type: "action", position: { x: 630, y: 520 }, data: { nodeType: "move_lead_stage", label: "Fase: Proposta", config: { stage: "proposal" } } },
      { id: "b_working2", type: "action", position: { x: 810, y: 410 }, data: { nodeType: "set_lead_status", label: "Stato: In lavorazione", config: { status: "working" } } },
    ],
    edges: [
      { id: "b_e_trig", source: "b_trigger", target: "b_isSetter", type: "smoothstep" },
      { id: "b_e_setter_yes", source: "b_isSetter", target: "b_setterQual", sourceHandle: "true", label: "Sì", type: "smoothstep" },
      { id: "b_e_setter_no", source: "b_isSetter", target: "b_closerQual", sourceHandle: "false", label: "No", type: "smoothstep" },
      { id: "b_e_sq_yes", source: "b_setterQual", target: "b_setQ", sourceHandle: "true", label: "Sì", type: "smoothstep" },
      { id: "b_e_setQ_move", source: "b_setQ", target: "b_moveOpp", type: "smoothstep" },
      { id: "b_e_move_task", source: "b_moveOpp", target: "b_leoTask", type: "smoothstep" },
      { id: "b_e_task_email", source: "b_leoTask", target: "b_emailLeo", type: "smoothstep" },
      { id: "b_e_sq_no", source: "b_setterQual", target: "b_setterLost", sourceHandle: "false", label: "No", type: "smoothstep" },
      { id: "b_e_lost_yes", source: "b_setterLost", target: "b_lost", sourceHandle: "true", label: "Sì", type: "smoothstep" },
      { id: "b_e_lost_no", source: "b_setterLost", target: "b_working1", sourceHandle: "false", label: "No", type: "smoothstep" },
      { id: "b_e_cq_yes", source: "b_closerQual", target: "b_setQ2", sourceHandle: "true", label: "Sì", type: "smoothstep" },
      { id: "b_e_setQ2_move", source: "b_setQ2", target: "b_moveProp", type: "smoothstep" },
      { id: "b_e_cq_no", source: "b_closerQual", target: "b_working2", sourceHandle: "false", label: "No", type: "smoothstep" },
    ],
  };
}

async function main() {
  if (!PROJECT || !API_KEY) throw new Error("Mancano APPWRITE_PROJECT_ID / APPWRITE_API_KEY in .env.local");
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const db = new Databases(client);

  console.log(`Setter=${SETTER_NAME} email=${CUGINA_EMAIL || "(vuota)"} · Closer id=${LEO_ID} email=${LEO_EMAIL || "(vuota)"}\n`);

  console.log("Workflow (visibili e modificabili nel CRM):");
  await upsertWorkflow(db, buildWorkflowA());
  await upsertWorkflow(db, buildWorkflowB());

  console.log("\nRegole automazione (il routing ora è nel Workflow B):");
  await setRuleActions(db, "call_completed", ["save_call_outcome"]);
  await setRuleActions(db, "lead_created", [
    "classify_lead_category",
    "create_or_update_contact",
    "set_pipeline_stage_prospect",
    "create_setter_call_task",
    "notify_internal_team",
  ]);

  const bl = await db.listDocuments(DB_ID, "booking_links", [Query.equal("slug", LEO_BOOKING_SLUG), Query.limit(1)]);
  console.log("\nBooking closer:");
  console.log(bl.total ? `  ✓ /book/${LEO_BOOKING_SLUG} presente` : `  ⚠ /book/${LEO_BOOKING_SLUG} mancante → npx tsx scripts/seed-call-funnel.ts`);

  console.log("\nFatto. Funnel a 2 call nel builder, confronti in italiano (etichette esito).");
}

main().catch((e) => {
  console.error("Errore seed-builder-funnel:", e);
  process.exit(1);
});
