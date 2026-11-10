// Vendiora: the info-business area inside the SarconX CRM (packages, bot WhatsApp, clients, coaching calls).
// Shared by server and client: keep it free of server imports.

export interface VdPackage {
  id: string;
  name: string;
  /** Short line shown in lists and on the contract */
  tagline: string | null;
  /** What is included, one item per line (goes in the contract) */
  deliverables: string | null;
  /** Price in cents, VAT excluded. null = not set yet */
  price: number | null;
  vatRate: number;
  includedCalls: number;
  /** Days from the kick-off call to the store going live (guarantee) */
  buildDays: number;
  /** Coaching period in days */
  coachingDays: number;
  /** Guarantee text, e.g. "Store online in 7 giorni o rimborso" */
  guarantee: string | null;
  /** Payment options shown on the contract (free text) */
  paymentTerms: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export const CLIENT_STATUSES = ["onboarding", "costruzione", "affiancamento", "concluso", "sospeso"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_CONFIG: Record<ClientStatus, { label: string; hint: string; tone: string }> = {
  onboarding: { label: "Onboarding", hint: "Contratto, pagamento, call di avvio", tone: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300" },
  costruzione: { label: "Store in costruzione", hint: "I giorni della garanzia stanno correndo", tone: "bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300" },
  affiancamento: { label: "Affiancamento", hint: "Store online, call settimanali", tone: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300" },
  concluso: { label: "Concluso", hint: "Percorso finito", tone: "bg-muted text-muted-foreground ring-border" },
  sospeso: { label: "Sospeso", hint: "In pausa o rimborsato", tone: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300" },
};

export function isClientStatus(v: unknown): v is ClientStatus {
  return typeof v === "string" && (CLIENT_STATUSES as readonly string[]).includes(v);
}

export interface VdClient {
  id: string;
  leadId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  phoneE164: string | null;
  /** Client details for the contract: tax code / VAT, address */
  taxId: string | null;
  address: string | null;
  packageId: string | null;
  /** Snapshot of the package at sale time (JSON of VdPackage), so later edits don't change signed contracts */
  packageSnapshot: string | null;
  packageName: string;
  /** cents, VAT excluded */
  price: number;
  vatRate: number;
  paymentTerms: string | null;
  status: ClientStatus;
  contractNumber: string;
  contractDate: string;
  contractSignedAt: string | null;
  isPaid: boolean;
  paidAt: string | null;
  /** Kick-off call: the guarantee days start here */
  kickoffAt: string | null;
  storeLiveAt: string | null;
  storeUrl: string | null;
  coach: string | null;
  notes: string | null;
  createdAt: string;
}

export const CALL_STATUSES = ["da_prenotare", "prenotata", "fatta", "saltata"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];
export const CALL_STATUS_CONFIG: Record<CallStatus, { label: string; tone: string }> = {
  da_prenotare: { label: "Da prenotare", tone: "bg-muted text-muted-foreground ring-border" },
  prenotata: { label: "Prenotata", tone: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300" },
  fatta: { label: "Fatta", tone: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300" },
  saltata: { label: "Saltata", tone: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300" },
};
export function isCallStatus(v: unknown): v is CallStatus {
  return typeof v === "string" && (CALL_STATUSES as readonly string[]).includes(v);
}

export interface VdCall {
  id: string;
  clientId: string;
  clientName: string;
  number: number;
  title: string;
  status: CallStatus;
  scheduledAt: string | null;
  doneAt: string | null;
  notes: string | null;
}

export interface WaMessage {
  id: string;
  leadId: string | null;
  clientId: string | null;
  phoneE164: string | null;
  direction: "in" | "out";
  /** bot | user name | "telefono" (sent from the phone) | lead */
  author: string | null;
  text: string;
  waId: string | null;
  at: string;
}

export type BotState = "attivo" | "in_attesa" | "passato" | "fermo";
export const BOT_STATE_LABELS: Record<BotState, string> = {
  attivo: "Il bot sta facendo le domande",
  in_attesa: "In attesa che il lead risponda",
  passato: "Passato a una persona",
  fermo: "Bot fermo",
};

export interface Conversation {
  id: string;
  leadId: string;
  phoneE164: string;
  chatIds: string[];
  state: BotState;
  /** index of the question the lead is answering; questions.length = closing sent */
  step: number;
  answers: { q: string; a: string }[];
  lastInboundAt: string | null;
  handoffAt: string | null;
}

export interface BotSettings {
  enabled: boolean;
  greeting: string;
  questions: string[];
  closing: string;
  calendlyUrl: string;
  coachingBookingUrl: string;
  /** Appwrite user ids that get the handoff alert (Leonardo) */
  handoffUserIds: string[];
  handoffName: string;
}

export interface CompanySettings {
  name: string;
  legalForm: string;
  state: string;
  address: string;
  /** P.IVA / EIN / registration number */
  ein: string;
  email: string;
  phone: string;
  representative: string;
  representativeRole: string;
  bank: string;
  court: string;
}

export interface VendioraSettings {
  bot: BotSettings;
  company: CompanySettings;
}

export const DEFAULT_SETTINGS: VendioraSettings = {
  bot: {
    enabled: false,
    greeting:
      "Ciao {nome}! 👋 Sono l'assistente di VendiOra. Abbiamo ricevuto la tua richiesta per il percorso «Store Shopify in 7 giorni + coach per 90 giorni».\n\nTi faccio {n} domande veloci, così {referente} arriva alla call già preparato.",
    questions: [
      "Hai già un prodotto o un'idea di cosa vendere? Raccontamelo in due righe.",
      "Hai mai venduto online o aperto uno store prima d'ora?",
      "Quanto pensi di poter investire per partire, tra percorso e pubblicità? (meno di 2.000 €, 2.000–5.000 €, oltre 5.000 €)",
      "Entro quando vorresti avere il tuo store online?",
    ],
    closing:
      "Perfetto {nome}, grazie! Il prossimo passo è una call conoscitiva gratuita con {referente}: scegli tu giorno e orario qui 👉 {link}\n\nSe preferisci, scrivimi pure quando sei disponibile e ti ricontatta lui.",
    calendlyUrl: "",
    coachingBookingUrl: "",
    handoffUserIds: [],
    handoffName: "Leonardo",
  },
  company: {
    name: "VendiOra",
    legalForm: "",
    state: "",
    address: "",
    ein: "",
    email: "info@vendiora.it",
    phone: "",
    representative: "",
    representativeRole: "",
    bank: "",
    court: "",
  },
};

export function mergeSettings(raw: unknown): VendioraSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<VendioraSettings>;
  return {
    bot: { ...DEFAULT_SETTINGS.bot, ...(r.bot ?? {}) },
    company: { ...DEFAULT_SETTINGS.company, ...(r.company ?? {}) },
  };
}

/** {nome} {referente} {link} {n} placeholders */
export function fillTemplate(t: string, vars: Record<string, string>): string {
  return t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export const eur = (cents: number | null | undefined) =>
  cents == null ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always", minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

/** Guarantee deadline: kick-off + buildDays */
export function guaranteeDeadline(client: Pick<VdClient, "kickoffAt" | "packageSnapshot">): Date | null {
  if (!client.kickoffAt) return null;
  let days = 7;
  try {
    const p = client.packageSnapshot ? (JSON.parse(client.packageSnapshot) as Partial<VdPackage>) : null;
    if (p?.buildDays) days = p.buildDays;
  } catch { /* default */ }
  return new Date(Date.parse(client.kickoffAt) + days * 86_400_000);
}
