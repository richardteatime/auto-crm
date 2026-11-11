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
  /** Playbook package code (BASE, ELITE, DFY-S, DFY-SA, DFY-F): drives pipeline, calls and messages */
  code: string | null;
  createdAt: string;
}

export const CLIENT_STATUSES = ["onboarding", "costruzione", "affiancamento", "concluso", "sospeso", "rimborsato"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_CONFIG: Record<ClientStatus, { label: string; hint: string; tone: string }> = {
  onboarding: { label: "Onboarding", hint: "Contratto, pagamento, call di avvio", tone: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300" },
  costruzione: { label: "Store in costruzione", hint: "I giorni della garanzia stanno correndo", tone: "bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300" },
  affiancamento: { label: "Affiancamento", hint: "Store online, call settimanali", tone: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300" },
  concluso: { label: "Concluso", hint: "Percorso finito", tone: "bg-muted text-muted-foreground ring-border" },
  sospeso: { label: "Sospeso", hint: "In pausa", tone: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300" },
  rimborsato: { label: "Rimborsato", hint: "Percorso chiuso con rimborso", tone: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300" },
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
  /** Automatic WhatsApp messages already sent to this client: key → ISO date */
  autoLog: Record<string, string>;
  /** Playbook package code (see playbook.ts) */
  packageCode: string | null;
  /** Pipeline stage: O1–O7 (Consulenza), D1–D8 (Done For You), SOSP, RIMB */
  stage: string | null;
  health: "verde" | "giallo" | "rosso" | null;
  healthScore: number | null;
  /** Everything the playbook tracks on the client (objective, KPI, check-ins, accesses, upsell, installments, NPS…) */
  ops: ClientOps;
  createdAt: string;
}

export interface Installment {
  n: number;
  /** cents */
  amount: number;
  dueAt: string;
  status: "da_pagare" | "pagata" | "fallita";
  paidAt?: string | null;
  failedAt?: string | null;
}

export interface CheckIn { at: string; answers: string[] }

export interface ClientOps {
  /** Activation = contract signed + payment received (start of the package) */
  activatedAt?: string | null;
  /** Handover sheet filled by the closer */
  handover?: { goal?: string; motivation?: string; fears?: string; promises?: string } | null;
  objective?: string | null;
  kpiName?: string | null;
  kpiStart?: number | null;
  kpiTarget?: number | null;
  kpi?: { at: string; value: number }[];
  intakeAt?: string | null;
  quickWinAt?: string | null;
  planAt?: string | null;
  groupAt?: string | null;
  briefAt?: string | null;
  /** DFY: accesses checklist (label → received) */
  access?: Record<string, boolean>;
  accessesRequestedAt?: string | null;
  accessesAt?: string | null;
  storeReadyAt?: string | null;
  adsLaunchedAt?: string | null;
  coachVote?: number | null;
  coachVoteAt?: string | null;
  checkins?: CheckIn[];
  /** WhatsApp question the client is answering (check-in, onboarding check, NPS) */
  awaiting?: { kind: "checkin" | "g7" | "nps"; step: number; at: string; answers: string[] } | null;
  g7Vote?: number | null;
  nps?: number | null;
  npsAt?: string | null;
  testimonialAt?: string | null;
  referralCode?: string | null;
  referralClicks?: number;
  referrals?: { at: string; leadId: string; name: string }[];
  upsell?: { stage: string; readiness?: "si" | "no" | "forse" | null; suggested?: string | null; note?: string | null; at: string; leadId?: string | null } | null;
  installments?: Installment[];
  /** Payment link of the signed offer (used in the installment reminders) */
  paymentLink?: string | null;
  paymentStatus?: "saldato" | "a_rate" | "a_rischio" | null;
  noShows?: number;
  recoveryUsed?: boolean;
  homeworkMissed?: number;
  healthHistory?: { at: string; health: "verde" | "giallo" | "rosso"; score: number }[];
  healthSignals?: { key: string; label: string; value: string; detail: string; weight: number }[];
  /** Playbook messages and tasks already sent / created: key → ISO */
  sent?: Record<string, string>;
  /** Team owners */
  csm?: string | null;
  pm?: string | null;
  closer?: string | null;
  setter?: string | null;
  endAt?: string | null;
  /** Stage moved by hand: the engine does not move it back */
  stageManualAt?: string | null;
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
  /** When the automatic reminder for this call went out */
  reminderAt: string | null;
  /** Playbook code, e.g. BASE-C3 */
  code?: string | null;
  /** Deadline from the package calendar (activation, store delivery or ads launch) */
  dueAt?: string | null;
  /** Fathom (or manual) summary: decisions, homework, deadline */
  summary?: string | null;
  homework?: string | null;
  homeworkAt?: string | null;
  recordingUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Offers: the proposal sent to a lead before the sale (public link, accept online)
// ---------------------------------------------------------------------------

export const OFFER_STATUSES = ["bozza", "inviata", "vista", "accettata", "rifiutata", "scaduta"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export const OFFER_STATUS_CONFIG: Record<OfferStatus, { label: string; tone: string }> = {
  bozza: { label: "Da inviare", tone: "bg-muted text-muted-foreground ring-border" },
  inviata: { label: "Inviata", tone: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300" },
  vista: { label: "Vista dal lead", tone: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300" },
  accettata: { label: "Accettata", tone: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300" },
  rifiutata: { label: "Rifiutata", tone: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300" },
  scaduta: { label: "Scaduta", tone: "bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300" },
};
export const OPEN_OFFER: OfferStatus[] = ["bozza", "inviata", "vista"];

export interface VdOffer {
  id: string;
  number: string;
  /** Random secret in the public link /offerta/<token> */
  token: string;
  leadId: string | null;
  clientId: string | null;
  name: string;
  email: string | null;
  phoneE164: string | null;
  packageId: string | null;
  packageSnapshot: string | null;
  packageName: string;
  /** cents, VAT excluded */
  price: number;
  vatRate: number;
  /** Personal note shown at the top of the offer */
  message: string | null;
  status: OfferStatus;
  validUntil: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  answeredAt: string | null;
  followupAt: string | null;
  packageCode?: string | null;
  /** "firma": said yes in call → sign + pay (4h/24h/48h). "proposta": still deciding → 7-day follow-up (M3) */
  mode?: "firma" | "proposta" | null;
  taxId?: string | null;
  address?: string | null;
  signedAt?: string | null;
  signName?: string | null;
  signIp?: string | null;
  signHash?: string | null;
  paymentLink?: string | null;
  paidAt?: string | null;
  /** Contract text frozen at signing */
  contractText?: string | null;
  objection?: string | null;
  /** Installments plan, e.g. {"n":3} */
  payPlan?: { n: number; amounts?: number[]; dueDays?: number[] } | null;
  /** Playbook sequence already sent: key → ISO */
  autoLog?: Record<string, string>;
  createdAt: string;
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

export type BotState = "attivo" | "in_attesa" | "passato" | "fermo" | "programmato";
export const BOT_STATE_LABELS: Record<BotState, string> = {
  attivo: "Il bot sta facendo le domande",
  in_attesa: "In attesa che il lead risponda",
  passato: "Passato a una persona",
  fermo: "Bot fermo",
  programmato: "Primo messaggio in partenza (3 minuti dall'arrivo)",
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
  angle?: string | null;
  score?: number | null;
  /** qualificato | nurturing | null */
  qual?: string | null;
  /** Package recommended for the sales call */
  pkg?: string | null;
  /** Sales sequence (M1–M2) already sent: key → ISO */
  seqLog?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Team tasks (phone calls, personal messages, escalations): the playbook "task al …"
// ---------------------------------------------------------------------------

export const TASK_ROLES = ["commerciale", "csm", "coach", "pm", "admin", "ceo"] as const;
export type TaskRole = (typeof TASK_ROLES)[number];
export const TASK_ROLE_LABELS: Record<TaskRole, string> = {
  commerciale: "Commerciale", csm: "CSM", coach: "Coach", pm: "PM Done For You", admin: "Admin", ceo: "CEO",
};
export interface VdTask {
  id: string;
  key: string;
  clientId: string | null;
  leadId: string | null;
  title: string;
  detail: string | null;
  role: TaskRole;
  dueAt: string | null;
  status: "aperto" | "fatto";
  doneAt: string | null;
  doneBy: string | null;
  urgent: boolean;
  createdAt: string;
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

// Automatic WhatsApp messages (offer + after-sale journey)
export const AUTO_KEYS = ["offer", "offerFollowup", "welcome", "callReminder", "storeLive", "coachingEnd"] as const;
export type AutoKey = (typeof AUTO_KEYS)[number];
export interface AutoMessage { enabled: boolean; text: string }
export type AutomationSettings = Record<AutoKey, AutoMessage> & { offerValidDays: number };

export const AUTO_INFO: Record<AutoKey, { label: string; when: string; vars: string }> = {
  offer: { label: "Invio dell'offerta", when: "Quando premi «Invia offerta» dalla scheda del lead", vars: "{nome} {pacchetto} {prezzo} {link} {scadenza}" },
  offerFollowup: { label: "Promemoria offerta", when: "2 giorni dopo l'invio, se il lead non ha ancora risposto", vars: "{nome} {pacchetto} {link} {scadenza}" },
  welcome: { label: "Benvenuto", when: "Appena segni la vendita («Ha comprato»)", vars: "{nome} {pacchetto} {contratto} {prenota} {referente}" },
  callReminder: { label: "Promemoria call", when: "Il giorno prima di ogni call prenotata (fino a 24 ore prima)", vars: "{nome} {call} {data} {ora}" },
  storeLive: { label: "Store online", when: "Quando segni «Store online»", vars: "{nome} {store} {prenota}" },
  coachingEnd: { label: "Fine affiancamento", when: "Il giorno in cui finiscono i giorni di affiancamento del pacchetto", vars: "{nome} {referente}" },
};

export const DEFAULT_AUTOMATIONS: AutomationSettings = {
  offerValidDays: 7,
  offer: {
    enabled: true,
    text: "Ciao {nome}, come promesso ecco la tua proposta VendiOra per «{pacchetto}» ({prezzo} + IVA).\n\nTrovi tutto qui, e puoi accettarla direttamente dal link 👉 {link}\n\nÈ valida fino al {scadenza}. Per qualsiasi dubbio scrivimi pure qui.",
  },
  offerFollowup: {
    enabled: true,
    text: "Ciao {nome}, hai avuto modo di guardare la proposta per «{pacchetto}»? Se ti va ne parliamo 5 minuti. Il link è sempre questo 👉 {link} (valida fino al {scadenza}).",
  },
  welcome: {
    enabled: true,
    text: "Benvenuto in VendiOra, {nome}! 🎉 Il tuo percorso «{pacchetto}» è confermato (contratto {contratto}).\n\nIl primo passo è la call di avvio: prenotala qui 👉 {prenota}\n\nDa qui in poi {referente} ti segue passo passo.",
  },
  callReminder: {
    enabled: true,
    text: "Ciao {nome}, ti ricordo la {call} di {data} alle {ora}. Ci vediamo lì! Se hai un imprevisto avvisami qui almeno 24 ore prima.",
  },
  storeLive: {
    enabled: true,
    text: "{nome}, il tuo store è online! 🚀 {store}\n\nOra inizia l'affiancamento: prenota le prossime call qui 👉 {prenota}",
  },
  coachingEnd: {
    enabled: true,
    text: "Ciao {nome}, oggi si chiude il tuo periodo di affiancamento con VendiOra. Grazie per la fiducia! Se vuoi continuare a crescere insieme, {referente} ti spiega come.",
  },
};

export interface PlaybookSettings {
  /** Playbook (3 questions per angle, sequences M1–M10) or the old custom bot */
  enabled: boolean;
  brand: string;
  commerciale: string;
  /** Appwrite user ids per role: they get tasks and alerts */
  team: Record<TaskRole, string[]>;
  links: {
    salesBooking: string;
    salesCall: string;
    csmBooking: string;
    coachBooking: string;
    pmBooking: string;
    whatsappGroup: string;
    intakeForm: string;
    briefForm: string;
    resultsForm: string;
    preCallForm: string;
    welcomeVideo: string;
    preframeVideo: string;
    freeContent: string;
    caseStudy: string;
    review: string;
    referral: string;
    referralReward: string;
    privacy: string;
  };
  /** Contract data that is not in VendiOra company settings */
  contract: { vat: "esclusa" | "inclusa"; place: string; court: string; pec: string; taxCode: string };
  /** Message overrides: id → { enabled, text } (defaults in playbook-messages.ts) */
  messages: Record<string, { enabled?: boolean; text?: string }>;
  /** Shared secret for the Fathom / Zapier / Make webhook */
  fathomSecret: string;
}

export const DEFAULT_PLAYBOOK: PlaybookSettings = {
  enabled: false,
  brand: "VendiOra",
  commerciale: "",
  team: { commerciale: [], csm: [], coach: [], pm: [], admin: [], ceo: [] },
  links: {
    salesBooking: "", salesCall: "", csmBooking: "", coachBooking: "", pmBooking: "", whatsappGroup: "", intakeForm: "", briefForm: "",
    resultsForm: "", preCallForm: "", welcomeVideo: "", preframeVideo: "", freeContent: "", caseStudy: "", review: "", referral: "",
    referralReward: "", privacy: "",
  },
  contract: { vat: "esclusa", place: "", court: "", pec: "", taxCode: "" },
  messages: {},
  fathomSecret: "",
};

export interface VendioraSettings {
  bot: BotSettings;
  company: CompanySettings;
  automations: AutomationSettings;
  playbook: PlaybookSettings;
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
  automations: DEFAULT_AUTOMATIONS,
  playbook: DEFAULT_PLAYBOOK,
};

export function mergeSettings(raw: unknown): VendioraSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<VendioraSettings>;
  const a = (r.automations ?? {}) as Partial<AutomationSettings>;
  const automations = { ...DEFAULT_AUTOMATIONS, offerValidDays: typeof a.offerValidDays === "number" && a.offerValidDays > 0 ? a.offerValidDays : DEFAULT_AUTOMATIONS.offerValidDays } as AutomationSettings;
  for (const k of AUTO_KEYS) automations[k] = { ...DEFAULT_AUTOMATIONS[k], ...((a[k] as Partial<AutoMessage>) ?? {}) };
  const pb = (r.playbook ?? {}) as Partial<PlaybookSettings>;
  const team = { ...DEFAULT_PLAYBOOK.team } as Record<TaskRole, string[]>;
  for (const k of TASK_ROLES) {
    const v = (pb.team as Partial<Record<TaskRole, unknown>> | undefined)?.[k];
    if (Array.isArray(v)) team[k] = v.filter((x): x is string => typeof x === "string");
  }
  const playbook: PlaybookSettings = {
    ...DEFAULT_PLAYBOOK,
    ...pb,
    team,
    links: { ...DEFAULT_PLAYBOOK.links, ...(pb.links ?? {}) },
    contract: { ...DEFAULT_PLAYBOOK.contract, ...(pb.contract ?? {}) },
    messages: pb.messages && typeof pb.messages === "object" ? pb.messages : {},
  };
  return {
    bot: { ...DEFAULT_SETTINGS.bot, ...(r.bot ?? {}) },
    company: { ...DEFAULT_SETTINGS.company, ...(r.company ?? {}) },
    automations,
    playbook,
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
