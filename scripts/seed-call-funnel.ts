/**
 * Costruisce il funnel "call con Leo" end-to-end:
 *   1. Booking link  /book/call-leo  (assegnato a Leo, Lun-Ven 9-18)
 *   2. Form salvato  (Nome, Email [obbligatoria], Telefono [opzionale], Messaggio)
 *   3. Collega il form alla landing pubblicata /l/sarconx
 *   4. Workflow attivo:
 *        Trigger: form_submitted
 *        Condizione: if_field_exists(phone)
 *          - Sì (ha telefono)  -> Invia Email a Leo ("chiamalo")
 *          - No (solo email)    -> Invia Email al cliente col link di prenotazione
 *
 * Uso (dalla cartella auto-crm):  npx tsx scripts/seed-call-funnel.ts
 */
import { Client, Databases, ID, Query } from "node-appwrite";
import { config as loadEnv } from "dotenv";
import { defaultAvailability } from "../src/lib/capture/defaults";

loadEnv({ path: ".env.local" });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

// URL pubblico dove gira il CRM (per il link nella mail al cliente).
const PUBLIC_URL = "https://orchestrator-crm.app.easlydev.online";
const LEO_EMAIL = process.env.LEO_EMAIL || "francy3391@gmail.com";
const LANDING_SLUG = "sarconx";
const BOOKING_SLUG = "call-leo";

async function freeSlug(db: Databases, collection: string, base: string): Promise<string> {
  const candidates = [base, ...Array.from({ length: 30 }, (_, i) => `${base}-${i + 2}`)];
  for (const c of candidates) {
    const res = await db.listDocuments(DB_ID, collection, [Query.equal("slug", c), Query.limit(1)]);
    if (res.total === 0) return c;
  }
  return `${base}-${Date.now()}`;
}

async function main() {
  if (!PROJECT || !API_KEY) throw new Error("Mancano APPWRITE_PROJECT_ID / APPWRITE_API_KEY in .env.local");

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const db = new Databases(client);
  const now = new Date().toISOString();

  // -------------------------------------------------------------------------
  // 1) Booking link (idempotente)
  // -------------------------------------------------------------------------
  const blRes = await db.listDocuments(DB_ID, "booking_links", [
    Query.equal("slug", BOOKING_SLUG),
    Query.limit(1),
  ]);
  let booking = blRes.documents[0] as Record<string, unknown> | undefined;
  const availability = defaultAvailability();
  if (booking) {
    await db.updateDocument(DB_ID, "booking_links", booking.$id as string, {
      availability: JSON.stringify(availability),
      assignedTo: process.env.LEO_USER_ID || "leo",
      updatedAt: now,
    });
    console.log(`  ✓ Booking link /book/${BOOKING_SLUG} aggiornato`);
  } else {
    const bookingSlug = await freeSlug(db, "booking_links", BOOKING_SLUG);
    booking = await db.createDocument(DB_ID, "booking_links", ID.unique(), {
      name: "Call conoscitiva con Leo",
      slug: bookingSlug,
      assignedTo: process.env.LEO_USER_ID || "leo",
      durationMinutes: 30,
      availability: JSON.stringify(availability),
      successMessage: "Perfetto! La tua call con Leo è prenotata. Riceverai i dettagli via email.",
      redirectUrl: null,
      status: "active",
      bookingsCount: 0,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  ✓ Booking link /book/${bookingSlug} creato`);
  }
  const bookingUrl = `${PUBLIC_URL}/book/${(booking?.slug as string) || BOOKING_SLUG}`;

  // -------------------------------------------------------------------------
  // 2) Form salvato (idempotente)
  // -------------------------------------------------------------------------
  const formFields = [
    { id: "fld_name", type: "text", label: "Nome", placeholder: "Il tuo nome", crmField: "name", options: [], validation: { required: true, min: null, max: null, pattern: null } },
    { id: "fld_email", type: "email", label: "Email", placeholder: "tua@email.com", crmField: "email", options: [], validation: { required: true, min: null, max: null, pattern: null } },
    { id: "fld_phone", type: "phone", label: "Telefono (facoltativo)", placeholder: "+39 ...", crmField: "phone", options: [], validation: { required: false, min: null, max: null, pattern: null } },
    { id: "fld_message", type: "textarea", label: "Parlaci del tuo progetto", placeholder: "Due righe sul tuo obiettivo...", crmField: "message", options: [], validation: { required: false, min: null, max: null, pattern: null } },
  ];
  const formStyle = { theme: "light", primaryColor: "#4F46E5", borderRadius: 10, logoUrl: "", backgroundColor: "", buttonText: "Invia la richiesta", fontFamily: "" };
  const fmRes = await db.listDocuments(DB_ID, "forms", [
    Query.equal("name", "Form Lead — Landing SarconX"),
    Query.limit(1),
  ]);
  let form = fmRes.documents[0] as Record<string, unknown> | undefined;
  if (form) {
    await db.updateDocument(DB_ID, "forms", form.$id as string, {
      fields: JSON.stringify(formFields),
      style: JSON.stringify(formStyle),
      updatedAt: now,
    });
    console.log(`  ✓ Form aggiornato`);
  } else {
    form = await db.createDocument(DB_ID, "forms", ID.unique(), {
      name: "Form Lead — Landing SarconX",
      description: "Form della landing /l/sarconx. Email obbligatoria, telefono opzionale.",
      fields: JSON.stringify(formFields),
      style: JSON.stringify(formStyle),
      successMessage: "Grazie! Abbiamo ricevuto la tua richiesta — controlla la tua email.",
      redirectUrl: null,
      embedEnabled: true,
      status: "active",
      views: 0,
      submissions: 0,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  ✓ Form creato`);
  }

  // -------------------------------------------------------------------------
  // 3) Collega il form alla landing /l/sarconx (blocco "form")
  // -------------------------------------------------------------------------
  let landingLinked = false;
  const landingRes = await db.listDocuments(DB_ID, "landing_pages", [Query.equal("slug", LANDING_SLUG), Query.limit(1)]);
  if (landingRes.documents.length) {
    const landing = landingRes.documents[0];
    try {
      const cfg = JSON.parse(landing.config as string) as { blocks: Array<Record<string, unknown>> };
      for (const b of cfg.blocks) {
        if (b.type === "form") {
          b.formId = form.$id;
          landingLinked = true;
        }
      }
      if (landingLinked) {
        await db.updateDocument(DB_ID, "landing_pages", landing.$id, {
          config: JSON.stringify(cfg),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // config non parsabile: salta il collegamento
    }
  }

  // -------------------------------------------------------------------------
  // 4) Workflow condizionale telefono/email (idempotente)
  // -------------------------------------------------------------------------
  const nodes = [
    {
      id: "n_trigger",
      type: "trigger",
      position: { x: 280, y: 30 },
      data: { nodeType: "form_submitted", label: "Form Inviato", config: {} },
    },
    {
      id: "n_cond",
      type: "condition",
      position: { x: 280, y: 180 },
      data: { nodeType: "if_field_exists", label: "Ha lasciato il telefono?", config: { field: "phone" } },
    },
    {
      id: "n_leo",
      type: "action",
      position: { x: 60, y: 360 },
      data: {
        nodeType: "send_email",
        label: "Email a Leo (chiama)",
        config: {
          to: LEO_EMAIL,
          subject: "Nuovo lead da chiamare: {{trigger.payload.name}}",
          body:
            "<p>È arrivato un lead <strong>con numero di telefono</strong> — da chiamare.</p>" +
            "<ul>" +
            "<li>Nome: {{trigger.payload.name}}</li>" +
            "<li>Telefono: {{trigger.payload.phone}}</li>" +
            "<li>Email: {{trigger.payload.email}}</li>" +
            "<li>Messaggio: {{trigger.payload.message}}</li>" +
            "</ul>",
        },
      },
    },
    {
      id: "n_client",
      type: "action",
      position: { x: 500, y: 360 },
      data: {
        nodeType: "send_email",
        label: "Email al cliente (prenota)",
        config: {
          to: "{{trigger.payload.email}}",
          subject: "Prenota la tua call gratuita con SarconX",
          body:
            "<p>Ciao {{trigger.payload.name}},</p>" +
            "<p>grazie per la tua richiesta! Scegli tu quando sentirci: prenota la tua call gratuita con Leo.</p>" +
            `<p><a href="${bookingUrl}" style="background:#4F46E5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Prenota la call &rarr;</a></p>` +
            `<p>Oppure copia questo link: ${bookingUrl}</p>`,
        },
      },
    },
  ];
  const edges = [
    { id: "e_trigger_cond", source: "n_trigger", target: "n_cond", type: "smoothstep" },
    { id: "e_cond_leo", source: "n_cond", target: "n_leo", sourceHandle: "true", label: "Sì", type: "smoothstep" },
    { id: "e_cond_client", source: "n_cond", target: "n_client", sourceHandle: "false", label: "No", type: "smoothstep" },
  ];

  const wfRes = await db.listDocuments(DB_ID, "workflows", [
    Query.equal("name", "Lead dal form → Leo chiama o cliente prenota"),
    Query.limit(1),
  ]);
  let workflow = wfRes.documents[0] as Record<string, unknown> | undefined;
  if (workflow) {
    await db.updateDocument(DB_ID, "workflows", workflow.$id as string, {
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
      updatedAt: now,
    });
    console.log(`  ✓ Workflow aggiornato`);
  } else {
    workflow = await db.createDocument(DB_ID, "workflows", ID.unique(), {
      name: "Lead dal form → Leo chiama o cliente prenota",
      description: "Se il lead lascia il telefono, avvisa Leo. Altrimenti manda al cliente il link per prenotare la call.",
      status: "active",
      triggerType: "form_submitted",
      triggerConfig: "{}",
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  ✓ Workflow creato`);
  }

  console.log("\nOK — funnel call:");
  console.log(`  Booking link : ${bookingUrl}   (id ${booking.$id})`);
  console.log(`  Form         : id ${form.$id}`);
  console.log(`  Landing      : /l/${LANDING_SLUG} ${landingLinked ? "→ collegata al form" : "(blocco form non trovato!)"}`);
  console.log(`  Workflow     : "${workflow.name}" (id ${workflow.$id}, ATTIVO, trigger form_submitted)`);
}

main().catch((e) => {
  console.error("Errore seed-call-funnel:", e);
  process.exit(1);
});
