import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "@/lib/query17";

// ---------------------------------------------------------------------------
// Types (lightweight to avoid circular deps)
// ---------------------------------------------------------------------------

interface ContactDoc {
  $id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  temperature?: string;
  $createdAt: string;
}

interface DealDoc {
  $id: string;
  title: string;
  value?: number;
  contactName?: string | null;
  stageName?: string | null;
  $createdAt: string;
}

interface ActivityDoc {
  $id: string;
  type: string;
  description: string;
  contactName?: string | null;
  scheduledAt?: string | null;
  isCompleted?: boolean;
  $createdAt: string;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchRecentContacts(limit = 5): Promise<ContactDoc[]> {
  try {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.contacts, [
      Query.orderDesc("$updatedAt"),
      Query.limit(limit),
    ]);
    return res.documents as unknown as ContactDoc[];
  } catch {
    return [];
  }
}

async function fetchRecentDeals(limit = 5): Promise<DealDoc[]> {
  try {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.deals, [
      Query.orderDesc("$updatedAt"),
      Query.limit(limit),
    ]);
    return res.documents as unknown as DealDoc[];
  } catch {
    return [];
  }
}

async function fetchPendingActivities(limit = 5): Promise<ActivityDoc[]> {
  try {
    const now = new Date().toISOString();
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.activities, [
      Query.equal("isCompleted", false),
      Query.lessThanEqual("scheduledAt", now),
      Query.orderAsc("scheduledAt"),
      Query.limit(limit),
    ]);
    return res.documents as unknown as ActivityDoc[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCurrency(cents?: number | null): string {
  if (!cents) return "€0";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatContacts(contacts: ContactDoc[]): string {
  if (contacts.length === 0) return "Nessun contatto recente.";
  return contacts
    .map((c) => {
      const parts = [c.name];
      if (c.email) parts.push(`email: ${c.email}`);
      if (c.phone) parts.push(`tel: ${c.phone}`);
      if (c.company) parts.push(`azienda: ${c.company}`);
      if (c.temperature) parts.push(`temperatura: ${c.temperature}`);
      return `- ${parts.join(" | ")} [ID: ${c.$id}]`;
    })
    .join("\n");
}

function formatDeals(deals: DealDoc[]): string {
  if (deals.length === 0) return "Nessun deal recente.";
  return deals
    .map((d) => {
      const parts = [d.title];
      if (d.value !== undefined && d.value !== null)
        parts.push(formatCurrency(d.value));
      if (d.contactName) parts.push(`contatto: ${d.contactName}`);
      if (d.stageName) parts.push(`fase: ${d.stageName}`);
      return `- ${parts.join(" | ")} [ID: ${d.$id}]`;
    })
    .join("\n");
}

function formatActivities(activities: ActivityDoc[]): string {
  if (activities.length === 0) return "Nessuna attivita in sospeso.";
  return activities
    .map((a) => {
      const parts = [`[${a.type}] ${a.description}`];
      if (a.contactName) parts.push(`contatto: ${a.contactName}`);
      if (a.scheduledAt)
        parts.push(`scadenza: ${new Date(a.scheduledAt).toLocaleString("it-IT")}`);
      return `- ${parts.join(" | ")} [ID: ${a.$id}]`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a prompt for Hermes that includes recent CRM context.
 *
 * Because Hermes `chat -q` does not reliably resume sessions, we inject
 * the latest contacts, deals and pending activities so the model can
 * answer follow-up questions like "What is the email of the contact we
 * just created?" without a real conversation memory.
 */
export async function buildHermesContextPrompt(
  userMessage: string,
): Promise<string> {
  const [contacts, deals, activities] = await Promise.all([
    fetchRecentContacts(),
    fetchRecentDeals(),
    fetchPendingActivities(),
  ]);

  // If the DB is unreachable, just return the raw message (graceful fallback)
  if (contacts.length === 0 && deals.length === 0 && activities.length === 0) {
    return userMessage;
  }

  const contextParts = [
    "=== CONTESTO CRM (dati piu recenti) ===",
    "",
    "CONTATTI RECENTI (ultimi 5 aggiornati):",
    formatContacts(contacts),
    "",
    "DEAL RECENTI (ultimi 5 aggiornati):",
    formatDeals(deals),
    "",
    "ATTIVITA/FOLLOW-UP IN SOSPESO (scaduti o da fare):",
    formatActivities(activities),
    "",
    "=== ISTRUZIONI ===",
    "Usa i dati sopra per rispondere alla richiesta del founder.",
    "Se la richiesta si riferisce a 'il contatto che abbiamo appena creato' o simili, usa i CONTATTI RECENTI.",
    "Se la richiesta chiede follow-up o attivita, usa ATTIVITA IN SOSPESO.",
    "Non ripetere questo contesto nella risposta finale.",
    "",
    "=== MESSAGGIO DEL FOUNDER ===",
    userMessage,
  ];

  return contextParts.join("\n");
}
