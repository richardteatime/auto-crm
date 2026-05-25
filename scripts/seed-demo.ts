import { Client, Databases, Users, ID, Query } from "node-appwrite";
import { config } from "dotenv";
config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const projectId = process.env.APPWRITE_PROJECT_ID!;
const apiKey = process.env.APPWRITE_API_KEY!;
const dbId = process.env.APPWRITE_DATABASE_ID || "crm";

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const db = new Databases(client);
const users = new Users(client);

const DEMO_EMAIL = "demo@easlydev.it";
const DEMO_PASSWORD = "Demo123!";
const DEMO_NAME = "Utente Demo";

async function seed() {
  // 1. Crea o recupera utente demo
  let userId: string;
  try {
    const user = await users.create(ID.unique(), DEMO_EMAIL, undefined, DEMO_PASSWORD, DEMO_NAME);
    userId = user.$id;
    console.log(`Utente creato: ${DEMO_EMAIL}`);
  } catch (e: any) {
    if (e.message.includes("already exists") || e.message.includes("409")) {
      const list = await users.list([Query.equal("email", DEMO_EMAIL)]);
      userId = list.users[0].$id;
      console.log(`Utente esistente: ${DEMO_EMAIL}`);
    } else {
      throw e;
    }
  }

  // 2. Contatti demo
  const contactsData = [
    {
      name: "Mario Rossi",
      email: "mario.rossi@example.com",
      phone: "+39 333 1234567",
      company: "Rossi Srl",
      vatNumber: "IT12345678901",
      address: "Via Roma 1, Milano",
      source: "website",
      temperature: "hot",
      notes: "Interessato al piano premium. Ha chiesto demo personalizzata.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      name: "Luca Bianchi",
      email: "luca.bianchi@test.it",
      phone: "+39 338 9876543",
      company: "Bianchi Tech",
      vatNumber: null,
      address: null,
      source: "referido",
      temperature: "warm",
      notes: "In attesa di preventivo per sviluppo custom.",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      name: "Giulia Verdi",
      email: "giulia.verdi@demo.com",
      phone: "+39 347 4567890",
      company: null,
      vatNumber: null,
      address: null,
      source: "formulario",
      temperature: "cold",
      notes: "Scaricato ebook dal landing page.",
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      name: "Sofia Neri",
      email: "sofia.neri@agency.io",
      phone: "+39 320 1122334",
      company: "Neri Agency",
      vatNumber: "IT98765432109",
      address: "Corso Torino 45, Torino",
      source: "evento",
      temperature: "hot",
      notes: "Incontro al Web Marketing Festival. Molto interessata.",
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ];

  const contactIds: string[] = [];
  for (const c of contactsData) {
    try {
      const doc = await db.createDocument(dbId, "contacts", ID.unique(), c);
      contactIds.push(doc.$id);
      console.log(`Contatto creato: ${c.name}`);
    } catch (e: any) {
      console.error(`Errore contatto ${c.name}:`, e.message);
    }
  }

  if (contactIds.length === 0) {
    console.log("Nessun contatto creato, skip deals e attivita.");
    return;
  }

  // 3. Recupera pipeline stages
  const stagesRes = await db.listDocuments(dbId, "pipeline_stages", [Query.orderAsc("order")]);
  const stages = stagesRes.documents as any[];
  const stageProspetto = stages.find((s: any) => s.order === 1)?.$id || stages[0]?.$id;
  const stageContattato = stages.find((s: any) => s.order === 2)?.$id || stages[0]?.$id;
  const stageProposta = stages.find((s: any) => s.order === 3)?.$id || stages[0]?.$id;

  // 4. Deals demo
  const dealsData = [
    {
      title: "Sviluppo Web App Premium",
      value: 1500000, // 15.000 EUR in centesimi
      stageId: stageProposta,
      contactId: contactIds[0],
      contactName: contactsData[0].name,
      contactTemperature: "hot",
      stageName: stages.find((s: any) => s.$id === stageProposta)?.name || "Proposta",
      stageColor: stages.find((s: any) => s.$id === stageProposta)?.color || "#8b5cf6",
      expectedClose: new Date(Date.now() + 86400000 * 14).toISOString(),
      probability: 70,
      notes: "Cliente ha approvato lo scope. In attesa di contratto.",
      billingType: "una_tantum",
      isPaid: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      title: "Abbonamento Mensile CRM",
      value: 29900, // 299 EUR/mese in centesimi
      stageId: stageContattato,
      contactId: contactIds[1],
      contactName: contactsData[1].name,
      contactTemperature: "warm",
      stageName: stages.find((s: any) => s.$id === stageContattato)?.name || "Contattato",
      stageColor: stages.find((s: any) => s.$id === stageContattato)?.color || "#2563eb",
      expectedClose: new Date(Date.now() + 86400000 * 7).toISOString(),
      probability: 50,
      notes: "Ha visto la demo. Valutazione interna in corso.",
      billingType: "mensile",
      recurringMonths: 12,
      recurringStartDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      isPaid: false,
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      title: "Landing Page + Funnel",
      value: 350000, // 3.500 EUR in centesimi
      stageId: stageProspetto,
      contactId: contactIds[3],
      contactName: contactsData[3].name,
      contactTemperature: "hot",
      stageName: stages.find((s: any) => s.$id === stageProspetto)?.name || "Prospetto",
      stageColor: stages.find((s: any) => s.$id === stageProspetto)?.color || "#64748b",
      expectedClose: new Date(Date.now() + 86400000 * 10).toISOString(),
      probability: 40,
      notes: "Richiesta arrivata dopo l'evento. Da qualificare.",
      billingType: "una_tantum",
      isPaid: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const dealIds: string[] = [];
  for (const d of dealsData) {
    try {
      const doc = await db.createDocument(dbId, "deals", ID.unique(), d);
      dealIds.push(doc.$id);
      console.log(`Deal creato: ${d.title}`);
    } catch (e: any) {
      console.error(`Errore deal ${d.title}:`, e.message);
    }
  }

  // 5. Attivita demo
  const activitiesData = [
    {
      type: "call",
      description: "Call di qualifica con Mario Rossi",
      contactId: contactIds[0],
      contactName: contactsData[0].name,
      dealId: dealIds[0] || null,
      startAt: new Date(Date.now() - 3600000).toISOString(),
      endAt: new Date(Date.now() - 1800000).toISOString(),
      notes: "Cliente molto interessato. Budget confermato 15k.",
      isCompleted: true,
      completedAt: new Date(Date.now() - 1800000).toISOString(),
      scheduledAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      type: "email",
      description: "Invio preventivo a Luca Bianchi",
      contactId: contactIds[1],
      contactName: contactsData[1].name,
      dealId: dealIds[1] || null,
      notes: "Preventivo per abbonamento annuale con sconto 10%.",
      isCompleted: true,
      completedAt: new Date(Date.now() - 7200000).toISOString(),
      scheduledAt: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      type: "follow_up",
      description: "Follow-up con Giulia Verdi",
      contactId: contactIds[2],
      contactName: contactsData[2].name,
      notes: "Chiedere feedback sull'ebook e proporre call.",
      isCompleted: false,
      scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      type: "meeting",
      description: "Demo prodotto per Sofia Neri",
      contactId: contactIds[3],
      contactName: contactsData[3].name,
      dealId: dealIds[2] || null,
      startAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      endAt: new Date(Date.now() + 86400000 * 3 + 3600000).toISOString(),
      notes: "Preparare slide custom per agency.",
      isCompleted: false,
      scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  for (const a of activitiesData) {
    try {
      await db.createDocument(dbId, "activities", ID.unique(), a);
      console.log(`Attivita creata: ${a.description}`);
    } catch (e: any) {
      console.error(`Errore attivita ${a.description}:`, e.message);
    }
  }

  console.log("\nSeed demo completato!");
}

seed().catch((e) => {
  console.error("Seed fallito:", e);
  process.exit(1);
});
