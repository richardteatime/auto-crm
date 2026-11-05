// ---------------------------------------------------------------------------
// Quote clauses: general conditions + service-specific conditions.
// The groups that apply are detected from the quote lines (service names and
// quote title, plus recurring billing). Per quote the user can switch single
// clauses off/on and add free text (stored in quotes.clauses as JSON).
//
// Values in CLAUSE_PARAMS come from Leonardo. Clauses that use a value still
// listed in PENDING_PARAMS are OFF by default: they can be ticked per quote
// but are not printed automatically until the value is confirmed.
// ---------------------------------------------------------------------------

import { normalizeServiceName } from "@/lib/quote-items";

export const CLAUSE_PARAMS = {
  // Confirmed by Leonardo (Nov 2026)
  domainCost: "inferiore a 50 € all'anno",
  noticeDays: "15 giorni",
  // To confirm
  hostingIncluded: "i primi 12 mesi",
  hostingRenewal: "€ … + IVA all'anno",
  revisions: "2",
  testDays: "10 giorni",
  warrantyMonths: "3 mesi",
} as const;

export type ClauseParam = keyof typeof CLAUSE_PARAMS;

/** Values not yet confirmed: clauses using them are off by default. */
export const PENDING_PARAMS: ReadonlySet<ClauseParam> = new Set<ClauseParam>([
  "hostingIncluded",
  "hostingRenewal",
  "revisions",
  "testDays",
  "warrantyMonths",
]);

export interface Clause {
  id: string;
  title: string;
  /** Text with {{param}} placeholders. */
  text: string;
}

export interface ClauseGroup {
  id: string;
  title: string;
  /** Normalised keywords matched on service names and quote title. */
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
      text: "Sono comprese esclusivamente le attività descritte nel presente preventivo. Ogni richiesta aggiuntiva o modifica successiva all'accettazione viene quotata a parte e avviata solo dopo approvazione del Cliente.",
    },
    {
      id: "gen-recesso",
      title: "Durata e recesso",
      text: "Il presente accordo non prevede vincoli di durata minima. Il Cliente può recedere in qualsiasi momento con comunicazione scritta, anche via email, con almeno {{noticeDays}} di preavviso. Restano dovuti i corrispettivi per le attività svolte e i servizi erogati fino alla data di cessazione.",
    },
    {
      id: "gen-collaborazione",
      title: "Materiali e collaborazione del Cliente",
      text: "Il Cliente indica un referente e fornisce, nei tempi indicati da SarconX, le informazioni, i contenuti, gli accessi e le approvazioni necessari allo svolgimento delle attività. Ritardi o mancata consegna comportano lo slittamento delle attività e delle date concordate.",
    },
    {
      id: "gen-tempi",
      title: "Avvio dei lavori",
      text: "Le attività iniziano dopo l'accettazione del preventivo e il pagamento dell'eventuale acconto.",
    },
    {
      id: "gen-terzi",
      title: "Costi di terzi",
      text: "Domini, licenze, piattaforme e budget pubblicitari sono pagati dal Cliente direttamente ai rispettivi fornitori, salvo che siano indicati tra le voci del preventivo.",
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
    title: "Sito web",
    keywords: ["sito", "siti", "website", "web site", "landing", "restyling", "wordpress", "vetrina", "portfolio", "blog", "pagina web"],
    clauses: [
      {
        id: "sito-dominio",
        title: "Dominio",
        text: "Il dominio viene registrato a nome del Cliente e pagato con un suo metodo di pagamento (carta) direttamente al fornitore, con un costo indicativo {{domainCost}}. SarconX si occupa della registrazione e della configurazione.",
      },
      {
        id: "sito-hosting",
        title: "Hosting",
        text: "L'hosting è incluso per {{hostingIncluded}} dalla messa online; successivamente il rinnovo ha un costo di {{hostingRenewal}}.",
      },
      {
        id: "sito-contenuti",
        title: "Contenuti del sito",
        text: "Testi, immagini, loghi e informazioni per il sito sono forniti dal Cliente in formato digitale, nei tempi indicati da SarconX. Copywriting, servizi fotografici e acquisto di immagini sono esclusi se non indicati tra le voci.",
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
        text: "Per {{warrantyMonths}} dalla messa online SarconX corregge gratuitamente i malfunzionamenti dovuti al proprio sviluppo.",
      },
      {
        id: "sito-manutenzione",
        title: "Manutenzione",
        text: "Aggiornamenti, nuove funzionalità e manutenzione continuativa non sono inclusi, salvo specifica voce di canone.",
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
        text: "Condizioni di vendita, diritto di recesso dei consumatori, adempimenti fiscali e obblighi verso i clienti finali restano di responsabilità del Cliente.",
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
        text: "Per {{warrantyMonths}} dal rilascio SarconX corregge gratuitamente i malfunzionamenti dovuti al proprio sviluppo. Evoluzioni e nuove funzionalità sono escluse.",
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
    title: "Gestione campagne Meta / Google",
    keywords: ["ads", "adv", "advertising", "campagn", "meta", "sponsorizzat", "lead generation", "pubblicit"],
    clauses: [
      {
        id: "ads-budget",
        title: "Budget pubblicitario",
        text: "Il budget pubblicitario non è compreso nel preventivo: è pagato direttamente dal Cliente alle piattaforme (Meta, Google) con un metodo di pagamento a lui intestato.",
      },
      {
        id: "ads-contenuti",
        title: "Contenuti per le campagne",
        text: "Il Cliente fornisce, nei tempi indicati da SarconX, i materiali richiesti per le campagne (foto, video, testi, informazioni su prodotti, servizi e promozioni) e approva gli annunci prima della pubblicazione. Ritardi o mancata consegna possono rinviare l'avvio o limitare il rendimento delle campagne.",
      },
      {
        id: "ads-account",
        title: "Account",
        text: "Le campagne sono gestite sugli account pubblicitari del Cliente, che ne resta proprietario anche al termine della collaborazione.",
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
        text: "Foto, video e informazioni sono forniti dal Cliente nei tempi indicati da SarconX; servizi fotografici e riprese sono esclusi se non indicati tra le voci.",
      },
      {
        id: "soc-account",
        title: "Account",
        text: "I profili social restano di proprietà del Cliente, che concede a SarconX gli accessi necessari per la durata del servizio.",
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
        text: "I canoni decorrono dall'attivazione del servizio e si rinnovano di periodo in periodo (mese o anno) fino a recesso, da comunicare per iscritto con {{noticeDays}} di preavviso.",
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
const ALL_CLAUSE_IDS = new Set(ALL_GROUPS.flatMap((g) => g.clauses.map((c) => c.id)));

/** True when the clause uses a value that is still to be confirmed. */
export function isPendingClause(c: Clause): boolean {
  for (const m of c.text.matchAll(/\{\{(\w+)\}\}/g)) {
    if (PENDING_PARAMS.has(m[1] as ClauseParam)) return true;
  }
  return false;
}

// --- Per-quote selection ----------------------------------------------------

export interface QuoteClauses {
  /** Default-on clauses switched off for this quote. */
  excluded: string[];
  /** Default-off (pending) clauses switched on for this quote. */
  included: string[];
  /** Extra conditions typed for this quote (one per line). */
  extra: string;
}

export const EMPTY_CLAUSES: QuoteClauses = { excluded: [], included: [], extra: "" };

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
  const ids = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && ALL_CLAUSE_IDS.has(x)).slice(0, 100) : [];
  return {
    excluded: ids(o.excluded),
    included: ids(o.included),
    extra: typeof o.extra === "string" ? o.extra.slice(0, 3000) : "",
  };
}

export function serializeQuoteClauses(raw: unknown): string | null {
  const c = parseQuoteClauses(raw);
  return c.excluded.length || c.included.length || c.extra.trim() ? JSON.stringify(c) : null;
}

export function isClauseOn(c: Clause, selection: QuoteClauses): boolean {
  return isPendingClause(c) ? selection.included.includes(c.id) : !selection.excluded.includes(c.id);
}

/** Selection after flipping one clause. */
export function toggleClause(c: Clause, selection: QuoteClauses): QuoteClauses {
  const flip = (list: string[]) => (list.includes(c.id) ? list.filter((x) => x !== c.id) : [...list, c.id]);
  return isPendingClause(c)
    ? { ...selection, included: flip(selection.included) }
    : { ...selection, excluded: flip(selection.excluded) };
}

// --- Detection --------------------------------------------------------------

interface LineLike {
  description?: string;
  billingType?: string;
  isSetup?: boolean;
}

function matches(text: string, keyword: string): boolean {
  // Matched at word start: "campagn" matches "campagne"; short keywords
  // ("app", "ads") must be whole words so "appuntamenti" does not match.
  const k = normalizeServiceName(keyword);
  if (!k) return false;
  const re = new RegExp(`(^| )${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${k.length <= 3 ? "( |$)" : ""}`);
  return re.test(text);
}

/** Service groups that apply to these lines (general group excluded). */
export function detectServiceGroups(lines: LineLike[], title = ""): ClauseGroup[] {
  // Only service names and the quote title: long descriptions mention many
  // generic words and would add clauses for services that are not sold.
  const names = normalizeServiceName([title, ...lines.map((l) => l.description ?? "")].join(" "));
  const recurring = lines.some((l) => !l.isSetup && (l.billingType === "mensile" || l.billingType === "annuale"));

  const ids = new Set<string>();
  for (const g of SERVICE_GROUPS) {
    if (g.keywords.some((k) => matches(names, k)) || (g.onRecurring && recurring)) {
      ids.add(g.id);
      g.includes?.forEach((i) => ids.add(i));
    }
  }
  return SERVICE_GROUPS.filter((g) => ids.has(g.id));
}

export interface ResolvedClause {
  id: string;
  title: string;
  pending: boolean;
  /** Text split in plain parts and parameter values. */
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
  return { id: c.id, title: c.title, pending: isPendingClause(c), parts };
}

export function clauseText(c: Clause): string {
  return resolveClause(c).parts.map((p) => p.text).join("");
}

export interface ClauseSection {
  id: string;
  title: string;
  clauses: ResolvedClause[];
}

/** Sections to print: service-specific groups first, then general conditions. */
export function buildClauseSections(lines: LineLike[], title: string, selection: QuoteClauses): ClauseSection[] {
  const groups = [...detectServiceGroups(lines, title), GENERAL_GROUP];
  return groups
    .map((g) => ({
      id: g.id,
      title: g.title,
      clauses: g.clauses.filter((c) => isClauseOn(c, selection)).map(resolveClause),
    }))
    .filter((s) => s.clauses.length > 0);
}
