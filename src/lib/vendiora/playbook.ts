// VendiOra "Operations & Sales Playbook" + "Offerta di fornitura servizi e consulenza" turned into data.
// Pure module (shared by server and client): packages, call plans with codes, angles, qualification,
// pipelines (Vendite S, Consulenza O, Done For You D, Upsell U), health score, value ladder.
// Texts come from the two documents; nothing commercial is invented here.

export type Line = "consulenza" | "dfy";
export type PackageCode = "BASE" | "ELITE" | "DFY-S" | "DFY-SA" | "DFY-F";
export const PACKAGE_CODES: PackageCode[] = ["BASE", "ELITE", "DFY-S", "DFY-SA", "DFY-F"];

/** When a call is due: activation (+days), weekly from activation, store delivery (+days), ads launch (+days) */
export type CallAnchor = "start" | "delivery" | "launch";

export interface CallStep {
  n: number;
  code: string;
  title: string;
  anchor: CallAnchor;
  /** days from the anchor */
  days: number;
  when: string;
  what: string;
  homework: string;
  bring: string;
}

export interface PlaybookPackage {
  code: PackageCode;
  name: string;
  line: Line;
  price: number; // cents
  durationLabel: string;
  /** weeks of the consulting path (0 for DFY) */
  weeks: number;
  forWho: string;
  result: string;
  /** Allegato A: exact sheet of the offer document */
  sheetTitle: string;
  sheet: string[];
  access: string[];
  calls: CallStep[];
  sortOrder: number;
}

const W = (k: number) => 2 + (k - 1) * 7; // call 1 within 48 h, then one a week

const BASE_CALLS: CallStep[] = [
  { n: 1, code: "BASE-C1", title: "Analisi situazione", anchor: "start", days: W(1), when: "Settimana 1",
    what: "Situazione di partenza, obiettivi, budget, eventuale store esistente; spiegazione del percorso e delle regole",
    homework: "Compilare il form di intake; analizzare 3 store concorrenti; aprire la prova Shopify; confermare il budget per ads",
    bring: "Analisi dei concorrenti e 3 nicchie candidate" },
  { n: 2, code: "BASE-C2", title: "Identificazione prodotto", anchor: "start", days: W(2), when: "Settimana 2",
    what: "Metodo di ricerca e validazione del prodotto; scelta del prodotto insieme",
    homework: "Selezionare 10 prodotti candidati; compilare la scheda di validazione dei 3 migliori; contattare 2 fornitori per prezzi e tempi",
    bring: "Prodotto scelto e preventivi dei fornitori" },
  { n: 3, code: "BASE-C3", title: "Creazione store", anchor: "start", days: W(3), when: "Settimana 3",
    what: "Costruiamo lo store in condivisione schermo: tema, pagina prodotto, policy, pagamenti, spedizioni",
    homework: "Completare lo store come visto in call; collegare dominio e pagamenti; fare un ordine di prova",
    bring: "Link dello store funzionante" },
  { n: 4, code: "BASE-C4", title: "Creazione adv", anchor: "start", days: W(4), when: "Settimana 4",
    what: "Hook, angle, video UGC, statiche e caroselli; esempi che funzionano oggi",
    homework: "Scrivere 5 hook; realizzare 3 creatività con i template visti in call",
    bring: "Creatività pronte da caricare" },
  { n: 5, code: "BASE-C5", title: "Setting BM e campagne", anchor: "start", days: W(5), when: "Settimana 5",
    what: "Business Manager, pixel, API di conversione, struttura delle campagne, budget",
    homework: "Configurare BM e pixel; preparare le campagne in bozza come viste in call",
    bring: "Campagne in bozza da controllare insieme" },
  { n: 6, code: "BASE-C6", title: "Lancio campagne e ottimizzazione", anchor: "start", days: W(6), when: "Settimana 6",
    what: "Lancio insieme, lettura dei numeri (CTR, CPC, aggiunte al carrello, vendite), regole per spegnere o scalare",
    homework: "Compilare il report dei numeri ogni giorno per 7 giorni; applicare le regole di ottimizzazione",
    bring: "Report numeri: base per la proposta del passo successivo" },
];

const ELITE_CALLS: CallStep[] = [
  ...BASE_CALLS.map((c) => ({ ...c, code: c.code.replace("BASE", "ELITE"), what: `${c.what} (con revisione dei compiti e più profondità su brand, margini e fornitori)` })),
  { n: 7, code: "ELITE-C7", title: "Analisi dopo 15 gg", anchor: "launch", days: 15, when: "15 giorni dal lancio delle campagne",
    what: "Lettura dei dati, cosa spegnere e cosa scalare, nuove creatività sugli angle vincenti",
    homework: "Applicare le decisioni prese in call; 3 nuove creatività; report giornaliero",
    bring: "Report di 15 giorni e nuove creatività" },
  { n: 8, code: "ELITE-C8", title: "Analisi dopo 30 gg", anchor: "launch", days: 30, when: "30 giorni dal lancio",
    what: "Bilancio del primo mese: margini reali, ROAS, offerta, pagina prodotto",
    homework: "Applicare le modifiche a offerta e store; impostare i test della fase successiva",
    bring: "Report di 30 giorni e test impostati" },
  { n: 9, code: "ELITE-C9", title: "Iterazioni", anchor: "launch", days: 37, when: "Dopo l'analisi dei 30 gg",
    what: "Iterazioni su creatività, offerta e campagne; piano per continuare da soli; ingresso nel network vendita",
    homework: "Piano dei 60 giorni successivi; presentarsi nel network",
    bring: "Base per la proposta del passo successivo" },
];

const ONB = (prefix: string, homework: string): CallStep => ({
  n: 1, code: `${prefix}-C1`, title: "Onboarding e spiegazione", anchor: "start", days: 2, when: "Giorno 1–2",
  what: "Spiegazione del pacchetto, tempi e cosa serve; brief su nicchia, stile, obiettivi", homework, bring: "Accessi completi (da qui partono i 7 giorni)",
});
const DELIVERY = (prefix: string, what: string, homework: string, bring: string): CallStep => ({
  n: 2, code: `${prefix}-C2`, title: "Consegna store", anchor: "delivery", days: 0, when: "Alla consegna", what, homework, bring,
});

export const PLAYBOOK_PACKAGES: PlaybookPackage[] = [
  {
    code: "BASE", name: "Base", line: "consulenza", price: 250000, durationLabel: "6 settimane", weeks: 6, sortOrder: 1,
    forWho: "Vuole imparare a lanciare un ecommerce da solo, con un consulente che gli mostra tutto e gli passa tips e trucchi.",
    result: "Store online, prima campagna lanciata, numeri letti e piano per i 30 giorni successivi.",
    sheetTitle: "Base – Consulenza, 6 settimane, 6 call – 2.500 €",
    sheet: [
      "6 call di consulenza, 1 a settimana: analisi della situazione, identificazione del prodotto, creazione dello store, creazione delle creatività pubblicitarie, impostazione di Business Manager e campagne, lancio e ottimizzazione delle campagne.",
      "Spiegazione del metodo, dimostrazioni pratiche, indicazioni operative e consigli del Fornitore.",
      "Accesso al gruppo WhatsApp del percorso per la durata del pacchetto.",
      "Compiti settimanali da svolgere in autonomia prima della call successiva.",
      "Esclusi: realizzazione dello store o delle creatività da parte del Fornitore, gestione delle campagne, costi di terzi.",
    ],
    access: ["Gruppo WhatsApp del percorso", "Compiti settimanali"],
    calls: BASE_CALLS,
  },
  {
    code: "ELITE", name: "Elite", line: "consulenza", price: 400000, durationLabel: "10 settimane", weeks: 10, sortOrder: 2,
    forWho: "Vuole il metodo completo con un affiancamento dettagliato, la revisione di ogni compito e il supporto anche dopo il lancio.",
    result: "Campagne lanciate e seguite per 30 giorni con noi, iterazioni su creatività e offerta, accesso al network vendita ecommerce.",
    sheetTitle: "Elite – Consulenza, 10 settimane, 9 call – 4.000 €",
    sheet: [
      "Le 6 call del pacchetto Base, con approfondimento su brand, margini e fornitori e revisione dei compiti.",
      "Call di analisi a 15 e a 30 giorni dal lancio delle campagne e call di iterazioni.",
      "Accesso al gruppo WhatsApp del percorso e al network di vendita ecommerce del Fornitore per la durata del pacchetto.",
      "Esclusi: realizzazione dello store o delle creatività da parte del Fornitore, gestione delle campagne, costi di terzi.",
    ],
    access: ["Gruppo WhatsApp del percorso", "Compiti con revisione", "Network vendita ecommerce"],
    calls: ELITE_CALLS,
  },
  {
    code: "DFY-S", name: "DFY Store", line: "dfy", price: 150000, durationLabel: "Consegna entro 7 giorni dal ricevimento di tutti gli accessi e materiali", weeks: 0, sortOrder: 3,
    forWho: "Vuole uno store pronto con un prodotto vincente, senza costruirlo.",
    result: "Store collegato e funzionante, consegnato entro 7 giorni dagli accessi, e il cliente sa gestirlo.",
    sheetTitle: "DFY Store – 1.500 €",
    sheet: [
      "Realizzazione di uno store ecommerce collegato e configurato, con un prodotto selezionato dal Fornitore.",
      "Consegna entro 7 giorni dal ricevimento di tutti gli accessi e materiali.",
      "3 call: onboarding e spiegazione, consegna dello store, analisi a 30 giorni dalla consegna.",
      "Esclusi: creatività, campagne pubblicitarie, logistica, budget pubblicitario, abbonamenti e costi di terzi.",
    ],
    access: ["Account Shopify", "Dominio", "Pagamenti", "Logo (se c'è)"],
    calls: [
      ONB("DFY-S", "Entro 3 giorni: account Shopify, dominio, pagamenti, logo se c'è"),
      DELIVERY("DFY-S", "Presentazione dello store e formazione sulla gestione quotidiana", "Ordine di prova; gestire lo store come visto in call; portare traffico; segnare i numeri", "Numeri dei 30 giorni"),
      { n: 3, code: "DFY-S-C3", title: "Analisi dopo 30 gg", anchor: "delivery", days: 30, when: "30 giorni dalla consegna", what: "Analisi dei numeri, correzioni, prossimi passi", homework: "—", bring: "Base per la proposta di servizi continuativi o upgrade" },
    ],
  },
  {
    code: "DFY-SA", name: "DFY Store + Ads", line: "dfy", price: 250000, durationLabel: "Consegna entro 7 giorni dal ricevimento di tutti gli accessi e materiali", weeks: 0, sortOrder: 4,
    forWho: "Vuole lo store con un prodotto top e il lancio della pubblicità, senza farlo da solo.",
    result: "Store consegnato entro 7 giorni dagli accessi, creatività realizzate e campagne lanciate.",
    sheetTitle: "DFY Store + Ads – 2.500 €",
    sheet: [
      "Quanto incluso in DFY Store, con prodotto selezionato di fascia top.",
      "Realizzazione delle creatività pubblicitarie, impostazione e lancio delle campagne.",
      "4 call: onboarding e spiegazione, consegna dello store, analisi a 15 e a 30 giorni dalla consegna.",
      "Esclusi: gestione continuativa delle campagne, logistica, budget pubblicitario e costi di terzi.",
    ],
    access: ["Account Shopify", "Dominio", "Pagamenti", "Meta Business come amministratore", "Carta per ads", "Budget confermato"],
    calls: [
      ONB("DFY-SA", "Entro 3 giorni: accessi Shopify, dominio, pagamenti, Meta Business come amministratore, carta per ads, budget confermato"),
      DELIVERY("DFY-SA", "Consegna dello store, lancio delle campagne, come leggere i numeri e gestire gli ordini", "Gestire ordini e assistenza; non modificare le campagne senza sentirci; segnare i numeri ogni giorno", "Numeri dei 15 giorni"),
      { n: 3, code: "DFY-SA-C3", title: "Analisi dopo 15 gg", anchor: "delivery", days: 15, when: "15 giorni dalla consegna", what: "Lettura dati, ottimizzazioni, nuove creatività se servono", homework: "Applicare le indicazioni; continuare il report", bring: "Numeri dei 30 giorni" },
      { n: 4, code: "DFY-SA-C4", title: "Analisi dopo 30 gg", anchor: "delivery", days: 30, when: "30 giorni dalla consegna", what: "Bilancio e piano per proseguire", homework: "—", bring: "Base per la proposta di servizi continuativi o upgrade a Full" },
    ],
  },
  {
    code: "DFY-F", name: "DFY Full", line: "dfy", price: 400000, durationLabel: "Consegna entro 7 giorni dal ricevimento di tutti gli accessi e materiali", weeks: 0, sortOrder: 5,
    forWho: "Vuole che facciamo tutto noi: store, creatività, ads, fornitore e logistica.",
    result: "Attività avviata, ads gestite e analizzate da noi, iterazioni dopo il primo mese.",
    sheetTitle: "DFY Full – 4.000 €",
    sheet: [
      "Quanto incluso in DFY Store + Ads.",
      "Gestione delle campagne da parte del Fornitore, individuazione di fornitore e logistica e coordinamento operativo.",
      "6 call: onboarding e spiegazione, consegna dello store, analisi delle campagne gestite dal Fornitore, analisi a 15 e a 30 giorni dalla consegna, iterazioni.",
      "Esclusi: budget pubblicitario, acquisto merce, spedizioni, dazi e altri costi di terzi.",
    ],
    access: ["Account Shopify", "Dominio", "Pagamenti", "Meta Business", "Carta per ads", "Contatti fornitore e logistica"],
    calls: [
      { ...ONB("DFY-F", "Entro 3 giorni: tutti gli accessi (Shopify, dominio, pagamenti, Meta Business), carta per ads e fornitore"), what: "Spiegazione del pacchetto, obiettivi, budget, piano" },
      DELIVERY("DFY-F", "Consegna dello store e lancio delle ads gestite da noi", "Controllare ordini e segnalare problemi di spedizioni o resi", "—"),
      { n: 3, code: "DFY-F-C3", title: "Analisi ads fatte da noi", anchor: "launch", days: 7, when: "7 giorni dal lancio (da confermare)", what: "Primi risultati delle campagne, cosa teniamo e cosa cambiamo", homework: "Confermare il budget per le settimane successive", bring: "—" },
      { n: 4, code: "DFY-F-C4", title: "Analisi dopo 15 gg", anchor: "delivery", days: 15, when: "15 giorni dalla consegna", what: "Dati, ottimizzazioni, nuove creatività", homework: "—", bring: "—" },
      { n: 5, code: "DFY-F-C5", title: "Analisi dopo 30 gg", anchor: "delivery", days: 30, when: "30 giorni dalla consegna", what: "Bilancio del primo mese", homework: "Decidere le priorità con noi", bring: "—" },
      { n: 6, code: "DFY-F-C6", title: "Iterazioni", anchor: "delivery", days: 45, when: "45 giorni dalla consegna (da confermare)", what: "Iterazioni su creatività, offerta, prodotto e logistica; piano di continuità", homework: "—", bring: "Base per la proposta di gestione continuativa" },
    ],
  },
];

export const playbookPackage = (code: string | null | undefined) => PLAYBOOK_PACKAGES.find((p) => p.code === code) ?? null;
export const lineOf = (code: string | null | undefined): Line | null => playbookPackage(code)?.line ?? null;

export const CALL_CODE_RE = /\b(BASE|ELITE|DFY-SA|DFY-S|DFY-F)-C(\d{1,2})\b|\bSALES-CALL\b/i;

// ---------------------------------------------------------------------------
// Angles + qualification
// ---------------------------------------------------------------------------

export type Angle = "A-DELUSO" | "A-SCAM" | "A-SISTEMA" | "A-SCALA";
export const ANGLES: Angle[] = ["A-DELUSO", "A-SCAM", "A-SISTEMA", "A-SCALA"];
export const ANGLE_INFO: Record<Angle, { label: string; pain: string; lever: string; first: PackageCode; alt: PackageCode; problem: string }> = {
  "A-DELUSO": { label: "Insoddisfatto di percorsi precedenti", pain: "Ha pagato, non ha avuto risultati né seguito", lever: "Affiancamento reale, call 1:1, risultati misurati", first: "ELITE", alt: "BASE", problem: "un percorso che non ti ha dato risultati" },
  "A-SCAM": { label: "Scottato dai fuffaguru", pain: "Sfiducia totale, teme un'altra truffa", lever: "Trasparenza: casi reali, store dei clienti, garanzie scritte", first: "BASE", alt: "DFY-S", problem: "dubbi su chi ti può aiutare davvero" },
  "A-SISTEMA": { label: "Ecommerce con problemi", pain: "Store che non vende, ads in perdita, caos operativo", lever: "Diagnosi dello store in call", first: "DFY-SA", alt: "BASE", problem: "uno store che non vende come dovrebbe" },
  "A-SCALA": { label: "Ecommerce da scalare", pain: "Vende ma è fermo, vuole crescere", lever: "Metodo, network vendita, gestione completa", first: "DFY-F", alt: "ELITE", problem: "un ecommerce fermo che vuoi far crescere" },
};
export const isAngle = (v: unknown): v is Angle => typeof v === "string" && (ANGLES as string[]).includes(v);

/** Angle from the form / campaign (tag "A-SCALA" in campaign, adset, ad or form name) */
export function angleFromText(...parts: (string | null | undefined)[]): Angle | null {
  const t = parts.filter(Boolean).join(" ").toUpperCase();
  for (const a of ANGLES) if (t.includes(a) || t.includes(a.replace("-", "_")) || t.includes(a.replace("-", " "))) return a;
  if (/\bDELUS/.test(t)) return "A-DELUSO";
  if (/\bSCAM|FUFFA/.test(t)) return "A-SCAM";
  if (/\bSISTEM/.test(t)) return "A-SISTEMA";
  if (/\bSCAL/.test(t)) return "A-SCALA";
  return null;
}

export type Budget = "si" | "ne_parliamo" | "no";
export type Mode = "imparare" | "fatto_per_te";

export function parseBudget(a: string): Budget | null {
  const t = a.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (/ne parliamo|parliamone|dipende|forse|vediamo|valuto|magari/.test(t)) return "ne_parliamo";
  if (/^\s*no\b|non (sono|posso|ho)|nessun|troppo|^\s*n\s*$/.test(t)) return "no";
  if (/^\s*(si|sì|ok|certo|assolutamente|yes|pronto|va bene)\b|\bsi\b|\bpronto\b/.test(t)) return "si";
  return null;
}

export function parseMode(a: string): Mode | null {
  const t = a.toLowerCase();
  if (/(fate|fatelo|fare voi|lo fate|per me|fatto per|delega|non ho tempo|voi)/.test(t)) return "fatto_per_te";
  if (/(imparar|io|da solo|da sola|capire|formazione|tu)/.test(t)) return "imparare";
  return null;
}

/** Qualification score: 3 answers + budget. Qualified = all 3 answered and budget "Sì" or "Ne parliamo" */
export function qualify(answers: string[]): { score: number; qualified: boolean; budget: Budget | null; mode: Mode | null } {
  const filled = answers.filter((a) => a && a.trim()).length;
  const budget = answers[2] ? parseBudget(answers[2]) : null;
  const mode = answers[1] ? parseMode(answers[1]) : null;
  let score = filled * 15; // max 45
  if (budget === "si") score += 55;
  else if (budget === "ne_parliamo") score += 35;
  else if (budget === null && answers[2]) score += 20; // unclear answer: let the closer judge
  const qualified = filled >= 3 && budget !== "no";
  return { score: Math.min(100, score), qualified, budget, mode };
}

/** Package to propose first in the sales call (angle table + "imparare / fatto per te" routing rule) */
export function recommendPackage(angle: Angle | null, mode: Mode | null): PackageCode {
  const info = angle ? ANGLE_INFO[angle] : null;
  const first = info?.first ?? (mode === "fatto_per_te" ? "DFY-S" : "BASE");
  if (!mode) return first;
  const want: Line = mode === "imparare" ? "consulenza" : "dfy";
  if (lineOf(first) === want) return first;
  if (info && lineOf(info.alt) === want) return info.alt;
  return want === "consulenza" ? "BASE" : "DFY-S";
}

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

export const SALES_STAGES = [
  { id: "S1", label: "Nuovo lead" }, { id: "S2", label: "In qualifica" }, { id: "S3", label: "Qualificato" },
  { id: "S4", label: "Call fissata" }, { id: "S4b", label: "No-show" }, { id: "S5", label: "Call svolta" },
  { id: "S6", label: "Follow-up" }, { id: "S7", label: "Vinto" }, { id: "PERSO", label: "Perso" }, { id: "NURT", label: "Nurturing" },
] as const;
export const CONSULENZA_STAGES = [
  { id: "O1", label: "Attivazione", exit: "Contratto firmato, pagamento ricevuto, call 1 prenotata" },
  { id: "O2", label: "Onboarding", exit: "Call 1 fatta, coach assegnato, obiettivo nel CRM, quick win consegnata" },
  { id: "O3", label: "Call 1–2", exit: "Call 2 fatta" },
  { id: "O4", label: "Call 3–4", exit: "Call 4 fatta" },
  { id: "O5", label: "Call 5–6", exit: "Call 6 fatta" },
  { id: "O6", label: "Post lancio (solo Elite)", exit: "Call 7, 8 e 9 fatte" },
  { id: "O7", label: "Concluso", exit: "" },
] as const;
export const DFY_STAGES = [
  { id: "D1", label: "Attivazione", exit: "Pagato, contratto firmato, call 1 prenotata" },
  { id: "D2", label: "Onboarding", exit: "Call 1 fatta: brief compilato (nicchia, budget ads, obiettivi, accessi richiesti)" },
  { id: "D3", label: "Accessi e materiali", exit: "Accessi Shopify, dominio, pagamenti, Meta Business ricevuti" },
  { id: "D4", label: "Produzione", exit: "Store pronto (+ creatività e ads per Store + Ads e Full; + fornitore e logistica per Full)" },
  { id: "D5", label: "Consegna", exit: "Store consegnato, cliente formato sulla gestione" },
  { id: "D6", label: "Follow-up", exit: "Call a +15 gg (Store + Ads e Full) e +30 gg (tutti) fatte" },
  { id: "D7", label: "Analisi e iterazioni (solo Full)", exit: "Call di analisi ads e call di iterazioni fatte, report numeri" },
  { id: "D8", label: "Concluso", exit: "Report finale e proposta upsell" },
] as const;
export const UPSELL_STAGES = [
  { id: "U1", label: "Segnale", hint: "Metà percorso: il coach valuta se è pronto per il livello successivo" },
  { id: "U2", label: "Raccolta risultati", hint: "2 settimane dalla fine: form risultati e testimonianza" },
  { id: "U3", label: "Call finale", hint: "Ultima call del pacchetto: risultati raggiunti, prossimo obiettivo" },
  { id: "U4", label: "Call upsell", hint: "Entro 7 giorni dalla call finale, con il closer" },
  { id: "U5", label: "Vinto", hint: "Nuovo pacchetto: riparte l'attivazione" },
  { id: "U6", label: "Non ora", hint: "Nurturing: contenuti + offerta ogni 60 giorni" },
] as const;
export type UpsellStage = (typeof UPSELL_STAGES)[number]["id"];
export const isUpsellStage = (v: unknown): v is UpsellStage => typeof v === "string" && UPSELL_STAGES.some((s) => s.id === v);
export const EXTRA_STAGES = { SOSP: "Sospeso", RIMB: "Rimborsato" } as const;

export function stageLabel(id: string | null | undefined): string {
  if (!id) return "—";
  const all = [...CONSULENZA_STAGES, ...DFY_STAGES, ...UPSELL_STAGES, ...SALES_STAGES] as { id: string; label: string }[];
  return all.find((s) => s.id === id)?.label ?? (EXTRA_STAGES as Record<string, string>)[id] ?? id;
}

/** Minimal shapes so this stays pure */
export interface StageClient {
  status: string;
  packageCode: string | null;
  contractSignedAt: string | null;
  isPaid: boolean;
  coach: string | null;
  storeLiveAt: string | null;
  ops: { objective?: string | null; quickWinAt?: string | null; accessesAt?: string | null; storeReadyAt?: string | null; briefAt?: string | null };
}
export interface StageCall { number: number; status: string; scheduledAt: string | null; code?: string | null }

export function computeStage(c: StageClient, calls: StageCall[]): string {
  if (c.status === "sospeso") return "SOSP";
  if (c.status === "rimborsato") return "RIMB";
  const line = lineOf(c.packageCode) ?? "consulenza";
  const done = (n: number) => calls.some((x) => x.number === n && x.status === "fatta");
  const booked = (n: number) => calls.some((x) => x.number === n && (x.status === "prenotata" || x.status === "fatta"));
  const allDone = calls.length > 0 && calls.every((x) => x.status === "fatta" || x.status === "saltata");
  if (c.status === "concluso" || allDone) return line === "dfy" ? "D8" : "O7";
  const active = !!c.contractSignedAt && c.isPaid && booked(1);
  if (line === "consulenza") {
    if (!active) return "O1";
    if (!done(1) || !c.coach || !c.ops.objective) return "O2";
    const next = calls.filter((x) => x.status !== "fatta" && x.status !== "saltata").sort((a, b) => a.number - b.number)[0]?.number ?? 99;
    if (next <= 2) return "O3";
    if (next <= 4) return "O4";
    if (next <= 6) return "O5";
    return "O6";
  }
  if (!active) return "D1";
  if (!done(1)) return "D2";
  if (!c.ops.accessesAt) return "D3";
  if (!c.ops.storeReadyAt && !c.storeLiveAt && !done(2)) return "D4";
  if (!done(2)) return "D5";
  const full = c.packageCode === "DFY-F";
  const pending = calls.filter((x) => x.number > 2 && x.status !== "fatta" && x.status !== "saltata").map((x) => x.number);
  if (full) {
    // C4 (+15) and C5 (+30) are the follow-up; C3 (ads analysis) and C6 (iterations) are D7
    if (pending.some((n) => n === 4 || n === 5)) return "D6";
    return pending.length ? "D7" : "D8";
  }
  return pending.length ? "D6" : "D8";
}

// ---------------------------------------------------------------------------
// Call due dates (calendar per package)
// ---------------------------------------------------------------------------

export interface DueAnchors { startAt: string | null; deliveryAt: string | null; launchAt: string | null; accessesAt: string | null }

const addDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86_400_000).toISOString();

/** Deadline of a call: from activation, store delivery or ads launch. Estimates when the anchor date is not known yet. */
export function callDueAt(step: Pick<CallStep, "anchor" | "days" | "n">, pkg: PackageCode | null, a: DueAnchors): string | null {
  if (!a.startAt) return null;
  if (step.anchor === "start") return addDays(a.startAt, step.days);
  // Delivery: real date, else accesses + 7 days, else activation + 2 (onboarding) + 3 (accesses) + 7 (production)
  const delivery = a.deliveryAt ?? (a.accessesAt ? addDays(a.accessesAt, 7) : addDays(a.startAt, 12));
  if (step.anchor === "delivery") return addDays(delivery, step.days);
  // Launch: real date, else the launch call (Elite C6) or the delivery (DFY Full launches at delivery)
  const launch = a.launchAt ?? (pkg === "ELITE" ? addDays(a.startAt, W(6)) : delivery);
  return addDays(launch, step.days);
}

// ---------------------------------------------------------------------------
// Health score (weekly): check-in 30%, calls booked vs expected 25%, KPI progress 25%, coach vote 20%
// ---------------------------------------------------------------------------

export type Health = "verde" | "giallo" | "rosso";
export const HEALTH_CONFIG: Record<Health, { label: string; tone: string; dot: string }> = {
  verde: { label: "Verde", tone: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300", dot: "bg-emerald-500" },
  giallo: { label: "Giallo", tone: "bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300", dot: "bg-amber-500" },
  rosso: { label: "Rosso", tone: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300", dot: "bg-rose-500" },
};
export const isHealth = (v: unknown): v is Health => v === "verde" || v === "giallo" || v === "rosso";

export interface HealthSignal { key: string; label: string; weight: number; value: Health; detail: string }

export interface HealthInput {
  line: Line;
  now: number;
  startAt: string | null;
  /** Fridays expected since the start and the check-ins received */
  checkinsMissed: number;
  /** Calls whose deadline has passed and are neither booked nor done */
  callsLate: number;
  /** KPI history (oldest first) */
  kpi: { at: string; value: number }[];
  coachVote: number | null;
  /** DFY: accesses delivered late (days), no-shows, homework skipped */
  accessesLateDays: number;
  noShows: number;
  homeworkMissed: number;
  onboardingIncompleteAtG10: boolean;
}

const tier = (v: Health) => (v === "verde" ? 1 : v === "giallo" ? 0.5 : 0);

export function computeHealth(h: HealthInput): { health: Health; score: number; signals: HealthSignal[] } {
  const s: HealthSignal[] = [];
  if (h.line === "consulenza") {
    s.push({ key: "checkin", label: "Check-in del venerdì", weight: 30, value: h.checkinsMissed >= 2 ? "rosso" : h.checkinsMissed === 1 ? "giallo" : "verde", detail: h.checkinsMissed ? `${h.checkinsMissed} saltati di fila` : "Fatti" });
  } else {
    s.push({ key: "materiali", label: "Materiali e accessi in tempo", weight: 30, value: h.accessesLateDays >= 3 ? "rosso" : h.accessesLateDays >= 1 ? "giallo" : "verde", detail: h.accessesLateDays ? `${h.accessesLateDays} giorni di ritardo` : "In tempo" });
  }
  const late = h.callsLate + (h.line === "dfy" ? h.noShows : 0);
  s.push({ key: "call", label: h.line === "dfy" ? "Presenza alle call" : "Call prenotate vs previste", weight: 25, value: late >= 2 ? "rosso" : late === 1 ? "giallo" : "verde", detail: late ? `${late} di ritardo` : "In linea" });
  // KPI: up = verde, flat 2 weeks = giallo, falling or flat 3+ weeks = rosso. No data in the first 2 weeks = verde.
  let kpi: Health = "verde"; let kd = "In linea con il piano";
  const last = h.kpi[h.kpi.length - 1];
  const started = h.startAt ? (h.now - Date.parse(h.startAt)) / 86_400_000 : 0;
  if (h.kpi.length >= 2 && last.value < h.kpi[h.kpi.length - 2].value) { kpi = "rosso"; kd = "In calo"; }
  else {
    const lastChange = [...h.kpi].reverse().find((k, i, arr) => i < arr.length - 1 && k.value !== arr[i + 1].value);
    const since = lastChange ? Date.parse(lastChange.at) : h.kpi[0] ? Date.parse(h.kpi[0].at) : h.startAt ? Date.parse(h.startAt) : h.now;
    const weeks = (h.now - since) / (7 * 86_400_000);
    if (started > 14 && weeks >= 3) { kpi = "rosso"; kd = `Fermo da ${Math.floor(weeks)} settimane`; }
    else if (started > 14 && weeks >= 2) { kpi = "giallo"; kd = "Fermo da 2 settimane"; }
  }
  s.push({ key: "kpi", label: h.line === "dfy" ? "Metriche dello store" : "Progressi sul KPI", weight: 25, value: kpi, detail: kd });
  const v = h.coachVote;
  s.push({ key: "coach", label: "Voto engagement del coach", weight: 20, value: v == null ? "verde" : v >= 4 ? "verde" : v === 3 ? "giallo" : "rosso", detail: v == null ? "Non ancora votato" : `${v}/5` });
  const score = Math.round(s.reduce((t, x) => t + x.weight * tier(x.value), 0));
  let health: Health = score >= 75 ? "verde" : score >= 45 ? "giallo" : "rosso";
  // Hard rules of the playbook
  if (health === "verde" && (h.onboardingIncompleteAtG10 || h.homeworkMissed >= 2)) health = "giallo";
  if (s.filter((x) => x.value === "rosso").length >= 2) health = "rosso";
  return { health, score, signals: s };
}

// ---------------------------------------------------------------------------
// Value ladder (who moves to what) + continuous services after DFY
// ---------------------------------------------------------------------------

export const VALUE_LADDER: { from: PackageCode[]; to: string; who: string; when: string }[] = [
  { from: ["BASE"], to: "Elite", who: "Ha capito il metodo e vuole lanciare o scalare un brand", when: "Settimana 5" },
  { from: ["BASE", "ELITE"], to: "DFY Store + Ads o DFY Full", who: "Ha capito cosa fare ma non ha tempo di farlo", when: "Ultima settimana" },
  { from: ["DFY-S"], to: "DFY Store + Ads (upgrade: differenza di prezzo)", who: "Lo store è pronto ma non ha traffico", when: "Call +30 gg" },
  { from: ["DFY-SA"], to: "DFY Full (upgrade)", who: "Le ads funzionano, vuole delegare logistica e gestione", when: "Call +30 gg" },
  { from: ["DFY-S", "DFY-SA"], to: "Elite", who: "Vuole imparare a gestire lo store da solo", when: "Call +30 gg" },
  { from: ["DFY-S", "DFY-SA", "DFY-F"], to: "Servizi continuativi", who: "Lo store è consegnato e deve crescere", when: "Call +30 gg (Store, Store + Ads), call iterazioni (Full)" },
];

export const CONTINUOUS_SERVICES = [
  { id: "ads", label: "Gestione ads mensile", what: "Gestione e ottimizzazione campagne Meta/TikTok, report mensile", signal: "Ads attive ma ROAS instabile, o nessuna ads" },
  { id: "creativita", label: "Creatività mensili", what: "Pacchetto mensile di video, UGC e grafiche nuove", signal: "Creatività esaurite, CTR in calo" },
  { id: "email", label: "Email e SMS marketing", what: "Flow automatici (carrello abbandonato, post-acquisto, win-back) e campagne", signal: "Traffico buono ma pochi riacquisti" },
  { id: "cro", label: "Ottimizzazione conversione (CRO)", what: "Analisi e modifiche a pagine prodotto, checkout, offerte", signal: "Tasso di conversione sotto l'1,5%" },
  { id: "prodotto", label: "Lancio nuovo prodotto", what: "Ricerca prodotto, pagina e lancio ads", signal: "Prodotto principale saturo" },
  { id: "care", label: "Customer care in outsourcing", what: "Gestione ticket, resi, recensioni", signal: "Volume ordini in crescita" },
  { id: "elite", label: "Consulenza Elite", what: "Il metodo per gestire tutto in autonomia", signal: "Cliente che fa molte domande operative" },
] as const;

export const LOSS_REASONS = ["prezzo", "tempistica", "fiducia", "decisore", "non adatto"] as const;
export const OBJECTIONS = ["prezzo", "tempo", "fiducia", "socio"] as const;
export type Objection = (typeof OBJECTIONS)[number];

/** Middle of the path (upsell signal): week 3 Base, week 5 Elite, call +30 for DFY */
export function midpointDays(code: string | null): number | null {
  if (code === "BASE") return 21;
  if (code === "ELITE") return 35;
  return null;
}
