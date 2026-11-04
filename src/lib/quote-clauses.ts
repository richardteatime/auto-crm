// ---------------------------------------------------------------------------
// Quote clauses: general conditions + service-specific conditions.
// The groups that apply are detected from the quote lines (keywords on name
// and description, plus recurring billing). Per quote the user can switch
// single clauses off and add free text (stored in quotes.clauses as JSON).
//
// DRAFT: texts and values below are a proposal to be approved by SarconX.
// While CLAUSES_DRAFT is true, values in CLAUSE_PARAMS are highlighted in the
// document as "to confirm".
// ---------------------------------------------------------------------------

import { normalizeServiceName } from "@/lib/quote-items";

export const CLAUSES_DRAFT = true;

/** Commercial values used inside the clauses. TO CONFIRM with Leonardo. */
export const CLAUSE_PARAMS = {
  hostingIncluded: "i primi 12 mesi",
  hostingRenewal: "€ … + IVA all'anno",
  contentDays: "15 giorni",
  revisions: "2",
  testDays: "10 giorni",
  warrantyMonths: "3 mesi",
  noticeDays: "30 giorni",
  adsMinMonths: "3 mesi",
  seoMinMonths: "6 mesi",
  socialMinMonths: "3 mesi",
} as const;

export type ClauseParam = keyof typeof CLAUSE_PARAMS;

export interface Clause {
  id: string;
  title: string;
  /** Text with {{param}} placeholders. */
  text: string;
}

export interface ClauseGroup {
  id: string;
  title: string;
  /** Normalised keywords matched on line names + descriptions. */
  keywords: string[];
  /** Also applies when the quote has recurring lines. */
  onRecurring?: boolean;
  /** Pulls in other groups (e-commerce is also a website). */
  includes?: string[];
  clauses: Clause[];
}

export const GENERAL_GROUP: ClauseGroup = {
  id: "generali",
  title: "Condizioni generali",
  keywords: [],
  clauses: [
    {
      id: "gen-oggetto",
      title: "Oggetto della fornitura",
      text: "Sono comprese esclusivamente le attività descritte nel presente preventivo. Ogni richiesta aggiuntiva o modifica successiva all'accettazione viene quotata a parte e avviata solo dopo approvazione scritta del Cliente.",
    },
    {
      id: "gen-tempi",
      title: "Avvio e tempistiche",
      text: "I tempi di realizzazione decorrono dall'accettazione del preventivo, dal pagamento dell'eventuale acconto e dalla ricezione dei materiali necessari. Ritardi nella consegna dei materiali o nelle approvazioni da parte del Cliente comportano lo slittamento delle date concordate.",
    },
    {
      id: "gen-collaborazione",
      title: "Collaborazione del Cliente",
      text: "Il Cliente indica un referente di progetto e fornisce informazioni, accessi e approvazioni necessari allo svolgimento delle attività.",
    },
    {
      id: "gen-proprieta",
      title: "Proprietà dei lavori",
      text: "Al saldo di quanto dovuto il Cliente acquisisce la proprietà dei materiali realizzati su misura. Restano esclusi software, librerie, temi e licenze di terze parti, soggetti ai rispettivi termini d'uso.",
    },
    {
      id: "gen-pagamenti",
      title: "Ritardi nei pagamenti",
      text: "In caso di mancato pagamento alle scadenze concordate, SarconX può sospendere le attività e i servizi attivi fino alla regolarizzazione.",
    },
    {
      id: "gen-riservatezza",
      title: "Riservatezza",
      text: "Le parti si impegnano a mantenere riservate le informazioni ricevute nell'ambito della collaborazione.",
    },
    {
      id: "gen-portfolio",
      title: "Referenze",
      text: "Salvo diversa indicazione del Cliente, SarconX può citare il progetto realizzato tra le proprie referenze.",
    },
  ],
};

export const SERVICE_GROUPS: ClauseGroup[] = [
  {
    id: "sito",
    title: "Siti web",
    keywords: ["sito", "siti", "website", "web site", "landing", "restyling", "wordpress", "vetrina", "portfolio", "blog", "pagina web"],
    clauses: [
      {
        id: "sito-hosting",
        title: "Dominio e hosting",
        text: "Dominio e hosting sono inclusi per {{hostingIncluded}} dalla messa online; successivamente il rinnovo ha un costo di {{hostingRenewal}}, salvo disdetta. Il dominio è intestato al Cliente.",
      },
      {
        id: "sito-contenuti",
        title: "Contenuti",
        text: "Testi, immagini, loghi e materiali sono forniti dal Cliente in formato digitale entro {{contentDays}} dall'accettazione. Copywriting, servizi fotografici e acquisto di immagini sono esclusi se non indicati tra le voci.",
      },
      {
        id: "sito-revisioni",
        title: "Revisioni",
        text: "Sono compresi {{revisions}} giri di revisione sulla proposta grafica. Ulteriori modifiche vengono quotate a parte.",
      },
      {
        id: "sito-collaudo",
        title: "Collaudo e messa online",
        text: "Prima della pubblicazione il Cliente ha {{testDays}} per verificare il sito e segnalare eventuali anomalie; trascorso tale termine senza segnalazioni il lavoro si intende accettato.",
      },
      {
        id: "sito-garanzia",
        title: "Garanzia",
        text: "Per {{warrantyMonths}} dalla messa online correggiamo gratuitamente i malfunzionamenti dovuti al nostro sviluppo. Aggiornamenti, nuove funzionalità e manutenzione continuativa non sono inclusi, salvo specifica voce di canone.",
      },
      {
        id: "sito-legali",
        title: "Privacy e cookie",
        text: "I testi legali (privacy policy, cookie policy) e la gestione del consenso sono a cura del Cliente o di un servizio dedicato, salvo diversa indicazione nel preventivo.",
      },
      {
        id: "sito-compatibilita",
        title: "Compatibilità",
        text: "Il sito è ottimizzato per le versioni aggiornate dei principali browser e per i dispositivi mobili.",
      },
    ],
  },
  {
    id: "ecommerce",
    title: "E-commerce",
    keywords: ["e commerce", "ecommerce", "shop", "negozio online", "shopify", "woocommerce", "prestashop", "vendita online", "catalogo prodotti"],
    includes: ["sito"],
    clauses: [
      {
        id: "ecom-catalogo",
        title: "Catalogo prodotti",
        text: "Il caricamento dei prodotti è incluso nella quantità indicata in offerta, sulla base di schede (testi, prezzi, immagini, varianti) fornite dal Cliente.",
      },
      {
        id: "ecom-pagamenti",
        title: "Pagamenti e spedizioni",
        text: "Le commissioni dei sistemi di pagamento (es. Stripe, PayPal) e i costi dei corrieri sono a carico del Cliente e regolati direttamente con i rispettivi fornitori.",
      },
      {
        id: "ecom-piattaforma",
        title: "Piattaforma e app",
        text: "Gli eventuali canoni della piattaforma e di app o plugin a pagamento sono a carico del Cliente, salvo che siano indicati tra le voci del preventivo.",
      },
      {
        id: "ecom-vendita",
        title: "Obblighi di vendita",
        text: "Condizioni di vendita, diritto di recesso, adempimenti fiscali e obblighi verso i consumatori restano di responsabilità del Cliente.",
      },
    ],
  },
  {
    id: "software",
    title: "Software, gestionali e app",
    keywords: ["gestionale", "crm", "software", "app", "applicazione", "portale", "dashboard", "automazion", "integrazion", "api", "web app"],
    clauses: [
      {
        id: "sw-requisiti",
        title: "Funzionalità",
        text: "Lo sviluppo comprende le funzionalità descritte nel preventivo. Funzionalità non previste vengono valutate e quotate separatamente.",
      },
      {
        id: "sw-infrastruttura",
        title: "Infrastruttura e servizi terzi",
        text: "Server, servizi cloud e licenze di terzi necessari al funzionamento sono a carico del Cliente, salvo che siano indicati tra le voci del preventivo.",
      },
      {
        id: "sw-collaudo",
        title: "Rilascio e collaudo",
        text: "Al rilascio il Cliente ha {{testDays}} per verificare il funzionamento e segnalare anomalie; trascorso tale termine senza segnalazioni il rilascio si intende accettato.",
      },
      {
        id: "sw-garanzia",
        title: "Garanzia",
        text: "Per {{warrantyMonths}} dal rilascio correggiamo gratuitamente i malfunzionamenti dovuti al nostro sviluppo. Evoluzioni e nuove funzionalità sono escluse.",
      },
      {
        id: "sw-dati",
        title: "Dati",
        text: "Il Cliente resta titolare dei dati inseriti; SarconX li tratta solo per l'erogazione del servizio, nel rispetto del GDPR e, ove necessario, come responsabile del trattamento.",
      },
    ],
  },
  {
    id: "ads",
    title: "Campagne pubblicitarie",
    keywords: ["ads", "adv", "advertising", "campagn", "meta", "sponsorizzat", "lead generation", "pubblicit"],
    clauses: [
      {
        id: "ads-budget",
        title: "Budget pubblicitario",
        text: "Il budget pubblicitario non è compreso nel preventivo: è pagato direttamente dal Cliente alle piattaforme (Meta, Google) con un metodo di pagamento a lui intestato.",
      },
      {
        id: "ads-account",
        title: "Account",
        text: "Le campagne sono gestite sugli account pubblicitari del Cliente, che ne resta proprietario anche al termine della collaborazione.",
      },
      {
        id: "ads-durata",
        title: "Durata",
        text: "Il servizio ha una durata minima di {{adsMinMonths}}; in seguito si rinnova di mese in mese, salvo disdetta scritta con {{noticeDays}} di preavviso.",
      },
      {
        id: "ads-risultati",
        title: "Risultati",
        text: "I risultati delle campagne dipendono da fattori esterni (mercato, concorrenza, algoritmi delle piattaforme): SarconX si impegna sulla qualità della gestione e dell'ottimizzazione, non su un numero prefissato di contatti o vendite.",
      },
      {
        id: "ads-policy",
        title: "Regole delle piattaforme",
        text: "Gli annunci sono soggetti alle regole delle piattaforme, che possono limitarli o rifiutarli indipendentemente da SarconX.",
      },
    ],
  },
  {
    id: "seo",
    title: "SEO e posizionamento",
    keywords: ["seo", "posizionamento", "indicizzazion", "google business", "scheda google"],
    clauses: [
      {
        id: "seo-risultati",
        title: "Risultati",
        text: "Il posizionamento organico richiede in genere alcuni mesi e dipende da fattori esterni (algoritmi dei motori di ricerca, concorrenza): non è possibile garantire posizioni specifiche.",
      },
      {
        id: "seo-accessi",
        title: "Accessi",
        text: "Il Cliente fornisce gli accessi necessari al sito e agli strumenti di analisi (Google Search Console, Google Analytics).",
      },
      {
        id: "seo-durata",
        title: "Durata",
        text: "Il servizio ha una durata minima di {{seoMinMonths}}; in seguito si rinnova di mese in mese, salvo disdetta scritta con {{noticeDays}} di preavviso.",
      },
    ],
  },
  {
    id: "social",
    title: "Gestione social",
    keywords: ["social", "piano editoriale", "community", "reel", "instagram content"],
    clauses: [
      {
        id: "soc-approvazione",
        title: "Piano editoriale",
        text: "Il piano editoriale viene sottoposto all'approvazione del Cliente prima della pubblicazione.",
      },
      {
        id: "soc-materiali",
        title: "Materiali",
        text: "Foto e video sono forniti dal Cliente; servizi fotografici e riprese sono esclusi se non indicati tra le voci.",
      },
      {
        id: "soc-account",
        title: "Account",
        text: "I profili social restano di proprietà del Cliente, che concede a SarconX gli accessi necessari per la durata del servizio.",
      },
      {
        id: "soc-durata",
        title: "Durata",
        text: "Il servizio ha una durata minima di {{socialMinMonths}}; in seguito si rinnova di mese in mese, salvo disdetta scritta con {{noticeDays}} di preavviso.",
      },
    ],
  },
  {
    id: "canoni",
    title: "Canoni e servizi ricorrenti",
    keywords: ["hosting", "manutenzion", "assistenza", "canone", "abbonamento"],
    onRecurring: true,
    clauses: [
      {
        id: "can-decorrenza",
        title: "Decorrenza e rinnovo",
        text: "I canoni decorrono dalla messa online o dall'attivazione del servizio e si rinnovano automaticamente per uguale periodo, salvo disdetta scritta con {{noticeDays}} di preavviso.",
      },
      {
        id: "can-adeguamento",
        title: "Servizi di terzi",
        text: "Eventuali aumenti dei costi applicati da fornitori terzi (hosting, licenze, piattaforme) possono essere riflessi sul canone, con comunicazione preventiva al Cliente.",
      },
    ],
  },
];

const ALL_GROUPS = [GENERAL_GROUP, ...SERVICE_GROUPS];
const GROUP_BY_ID = new Map(ALL_GROUPS.map((g) => [g.id, g]));

// --- Per-quote selection ----------------------------------------------------

export interface QuoteClauses {
  /** Clause ids switched off for this quote. */
  excluded: string[];
  /** Extra conditions typed for this quote (one per line). */
  extra: string;
}

export const EMPTY_CLAUSES: QuoteClauses = { excluded: [], extra: "" };

export function parseQuoteClauses(raw: unknown): QuoteClauses {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ...EMPTY_CLAUSES };
    }
  }
  if (!obj || typeof obj !== "object") return { ...EMPTY_CLAUSES };
  const o = obj as Record<string, unknown>;
  const known = new Set(ALL_GROUPS.flatMap((g) => g.clauses.map((c) => c.id)));
  return {
    excluded: Array.isArray(o.excluded)
      ? o.excluded.filter((x): x is string => typeof x === "string" && known.has(x)).slice(0, 100)
      : [],
    extra: typeof o.extra === "string" ? o.extra.slice(0, 3000) : "",
  };
}

export function serializeQuoteClauses(raw: unknown): string | null {
  const c = parseQuoteClauses(raw);
  return c.excluded.length || c.extra.trim() ? JSON.stringify(c) : null;
}

// --- Detection --------------------------------------------------------------

interface LineLike {
  description?: string;
  billingType?: string;
  isSetup?: boolean;
}

function matches(text: string, keyword: string): boolean {
  // keyword is matched at word start: "campagn" matches "campagne", "app" does not match "appuntamenti"
  const k = normalizeServiceName(keyword);
  if (!k) return false;
  const re = new RegExp(`(^| )${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${k.length <= 3 ? "( |$)" : ""}`);
  return re.test(text);
}

/** Service groups that apply to these lines (general group excluded). */
export function detectServiceGroups(lines: LineLike[], title = ""): ClauseGroup[] {
  // Only service names and the quote title are matched: long descriptions
  // mention many generic words ("contenuti", "integrazione") and would add
  // clauses for services that are not being sold.
  const names = normalizeServiceName([title, ...lines.map((l) => l.description ?? "")].join(" "));
  const recurring = lines.some((l) => !l.isSetup && (l.billingType === "mensile" || l.billingType === "annuale"));

  const ids = new Set<string>();
  for (const g of SERVICE_GROUPS) {
    const hit = g.keywords.some((k) => matches(names, k));
    if (hit || (g.onRecurring && recurring)) {
      ids.add(g.id);
      g.includes?.forEach((i) => ids.add(i));
    }
  }
  return SERVICE_GROUPS.filter((g) => ids.has(g.id));
}

export interface ResolvedClause {
  id: string;
  title: string;
  /** Text split in plain parts and parameter values (for highlighting). */
  parts: { text: string; param?: ClauseParam }[];
}

export function resolveClause(c: Clause): ResolvedClause {
  const parts: ResolvedClause["parts"] = [];
  const re = /\{\{(\w+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(c.text))) {
    if (m.index > last) parts.push({ text: c.text.slice(last, m.index) });
    const key = m[1] as ClauseParam;
    parts.push({ text: CLAUSE_PARAMS[key] ?? m[0], param: key });
    last = m.index + m[0].length;
  }
  if (last < c.text.length) parts.push({ text: c.text.slice(last) });
  return { id: c.id, title: c.title, parts };
}

export function clauseToText(c: Clause): string {
  return resolveClause(c).parts.map((p) => p.text).join("");
}

export interface ClauseSection {
  id: string;
  title: string;
  clauses: ResolvedClause[];
}

/** Sections to print: service-specific groups first, then general conditions. */
export function buildClauseSections(lines: LineLike[], title: string, selection: QuoteClauses): ClauseSection[] {
  const off = new Set(selection.excluded);
  const groups = [...detectServiceGroups(lines, title), GENERAL_GROUP];
  return groups
    .map((g) => ({
      id: g.id,
      title: g.title,
      clauses: g.clauses.filter((c) => !off.has(c.id)).map(resolveClause),
    }))
    .filter((s) => s.clauses.length > 0);
}

export function groupById(id: string): ClauseGroup | undefined {
  return GROUP_BY_ID.get(id);
}
