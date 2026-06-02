/**
 * Seed di una landing page demo ad alta conversione (lead-capture) per SarconX.
 * Inserisce una landing GIÀ PUBBLICATA nella collection `landing_pages`.
 *
 * Uso:  (dalla cartella auto-crm)
 *   npx tsx scripts/seed-landing.ts
 *
 * Il blocco `form` usa i campi predefiniti (nome/email/telefono/messaggio) →
 * ogni invio genera un LEAD nel CRM con source "landing".
 */
import { Client, Databases, ID, Query } from "node-appwrite";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";
const COLLECTION = "landing_pages";

let counter = 0;
const bid = (p: string) => `${p}_seed_${++counter}`;

function buildConfig() {
  return {
    theme: {
      primaryColor: "#4F46E5",
      fontFamily: "Inter, system-ui, sans-serif",
      maxWidth: 1120,
    },
    blocks: [
      {
        id: bid("hero"),
        type: "hero",
        heading: "Il tuo business merita un sistema che lavora anche mentre dormi",
        subheading:
          "SarconX progetta siti, web app e automazioni su misura che trasformano i visitatori in clienti — e ti liberano dal lavoro ripetitivo.",
        buttonText: "Richiedi la consulenza gratuita",
        buttonUrl: "#form",
        align: "center",
        backgroundColor: "#0B1120",
        textColor: "#FFFFFF",
      },
      {
        id: bid("logos"),
        type: "logos",
        heading: "Aziende che si fidano di noi",
        items: [
          { name: "Studio Rossi", imageUrl: "" },
          { name: "TechnoLab", imageUrl: "" },
          { name: "Verde Bio", imageUrl: "" },
          { name: "FoodHub", imageUrl: "" },
          { name: "MediCare", imageUrl: "" },
        ],
      },
      {
        id: bid("features"),
        type: "features",
        heading: "Un unico partner per tutto ciò che ti serve per crescere",
        items: [
          {
            title: "Siti & landing che convertono",
            description:
              "Design veloce e persuasivo, pensato per trasformare i clic in richieste reali — non solo per essere belli.",
            icon: "Rocket",
          },
          {
            title: "Web app su misura",
            description:
              "Gestionali e strumenti costruiti sul tuo processo, non il contrario. Tu lavori, il software ti segue.",
            icon: "Code",
          },
          {
            title: "Automazioni AI",
            description:
              "Lead, email, follow-up e preventivi gestiti in automatico. Recuperi ore ogni settimana.",
            icon: "Bot",
          },
        ],
      },
      {
        id: bid("comparison"),
        type: "comparison",
        heading: "Perché SarconX, e non un freelance o un'agenzia tradizionale",
        columns: ["SarconX", "Freelance", "Agenzia tradizionale"],
        highlightColumn: 0,
        rows: [
          { label: "Sito + automazioni in un unico partner", values: [true, false, false] },
          { label: "Tempi di consegna rapidi", values: [true, "Variabili", "Lenti"] },
          { label: "CRM e lead tracciati inclusi", values: [true, false, "Extra a pagamento"] },
          { label: "Supporto diretto col team", values: [true, "A volte", false] },
          { label: "Prezzo chiaro e trasparente", values: [true, "Dipende", false] },
        ],
      },
      {
        id: bid("reviews"),
        type: "reviews",
        heading: "Cosa dicono i clienti",
        averageRating: 4.9,
        ratingCountLabel: "su 87 progetti consegnati",
        items: [
          {
            quote:
              "In due settimane avevamo un sito che genera richieste ogni giorno. Prima dal web non arrivava nessuno.",
            author: "Marco Rossi",
            rating: 5,
          },
          {
            quote:
              "Hanno automatizzato tutta la gestione dei lead. Risparmio almeno 10 ore a settimana, davvero.",
            author: "Giulia Bianchi",
            rating: 5,
          },
          {
            quote:
              "Finalmente un partner che capisce il business e non solo il codice. Consigliatissimi.",
            author: "Antonio De Luca",
            rating: 5,
          },
        ],
      },
      {
        id: bid("offer"),
        type: "offer",
        badgeText: "Posti limitati questo mese",
        heading: "Consulenza strategica gratuita",
        priceLabel: "Gratis",
        comparePriceLabel: "€250",
        includes: [
          "Analisi del tuo sito o processo attuale",
          "Strategia su misura per generare più clienti",
          "Stima realistica di tempi e investimento",
          "Nessun impegno, nessuna sorpresa",
        ],
        buttonText: "Prenota la consulenza",
        buttonUrl: "#form",
        backgroundColor: "#4F46E5",
        textColor: "#FFFFFF",
      },
      {
        id: bid("faq"),
        type: "faq",
        heading: "Domande frequenti",
        items: [
          {
            question: "Quanto costa un progetto?",
            answer:
              "Dipende dall'obiettivo: un sito parte da poche centinaia di euro, una web app o un CRM su misura è un investimento maggiore. Nella consulenza gratuita ti diamo una stima onesta, senza sorprese.",
          },
          {
            question: "In quanto tempo siete operativi?",
            answer:
              "Una landing o un sito vetrina in 1-2 settimane. I progetti più complessi (web app, automazioni) li pianifichiamo insieme con tappe chiare e scadenze rispettate.",
          },
          {
            question: "Lavorate solo con grandi aziende?",
            answer:
              "No. Lavoriamo con professionisti, PMI e startup. Adattiamo soluzione e budget alla tua dimensione e al tuo momento.",
          },
          {
            question: "E dopo la consegna?",
            answer:
              "Restiamo il tuo partner: supporto, manutenzione e miglioramenti continui. Non spariamo dopo la fattura.",
          },
        ],
      },
      {
        id: bid("form"),
        type: "form",
        formId: null,
        heading: "Raccontaci il tuo progetto — ti rispondiamo entro 24 ore",
      },
      {
        id: bid("cta"),
        type: "cta",
        heading: "Pronto a far crescere il tuo business?",
        subheading:
          "Una chiamata gratuita può cambiare il modo in cui acquisisci clienti. Zero impegno.",
        buttonText: "Richiedi la consulenza gratuita",
        buttonUrl: "#form",
        backgroundColor: "#0B1120",
        textColor: "#FFFFFF",
      },
      {
        id: bid("footer"),
        type: "footer",
        text: "© 2026 SarconX — Sistemi digitali su misura per far crescere il tuo business.",
      },
    ],
  };
}

async function freeSlug(db: Databases, base: string): Promise<string> {
  const candidates = [base, ...Array.from({ length: 30 }, (_, i) => `${base}-${i + 2}`)];
  for (const c of candidates) {
    const res = await db.listDocuments(DB_ID, COLLECTION, [Query.equal("slug", c), Query.limit(1)]);
    if (res.total === 0) return c;
  }
  return `${base}-${Date.now()}`;
}

async function main() {
  if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    throw new Error("Mancano APPWRITE_PROJECT_ID / APPWRITE_API_KEY in .env.local");
  }

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);
  const db = new Databases(client);

  const slug = await freeSlug(db, "sarconx");
  const now = new Date().toISOString();

  const doc = await db.createDocument(DB_ID, COLLECTION, ID.unique(), {
    name: "SarconX — Landing Consulenza",
    slug,
    status: "published",
    templateId: null,
    config: JSON.stringify(buildConfig()),
    metaTitle: "SarconX — Siti, Web App e Automazioni che fanno crescere il tuo business",
    metaDescription:
      "Trasformiamo il tuo business con siti che convertono, web app su misura e automazioni AI. Richiedi una consulenza gratuita.",
    faviconUrl: null,
    ogImageUrl: null,
    views: 0,
    submissions: 0,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`OK — Landing creata: ${doc.$id}`);
  console.log(`Pubblica su: /l/${slug}`);
}

main().catch((e) => {
  console.error("Errore seed-landing:", e);
  process.exit(1);
});
