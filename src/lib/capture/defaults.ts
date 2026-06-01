// Factory helpers: produce new blocks, configs, and field defaults with
// sensible starting values. Pure functions, no external dependencies.

import type {
  BlockType,
  LandingBlock,
  LandingConfig,
  FormField,
  FormFieldType,
  FormStyle,
  BookingAvailability,
  DayAvailability,
  WeekdayKey,
} from "./types";
import { assertNever, WEEKDAY_KEYS } from "./types";

let counter = 0;
export function blockId(prefix = "blk"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function createBlock(type: BlockType): LandingBlock {
  const id = blockId(type);
  switch (type) {
    case "hero":
      return {
        id,
        type: "hero",
        heading: "Il titolo della tua offerta",
        subheading: "Una frase che spiega il valore in modo chiaro e diretto.",
        buttonText: "Inizia ora",
        buttonUrl: "#form",
        align: "center",
        backgroundColor: "#0f172a",
        textColor: "#ffffff",
      };
    case "features":
      return {
        id,
        type: "features",
        heading: "Perché sceglierci",
        items: [
          { title: "Veloce", description: "Risultati in tempi rapidi.", icon: "Zap" },
          { title: "Affidabile", description: "Supporto costante.", icon: "ShieldCheck" },
          { title: "Su misura", description: "Soluzioni personalizzate.", icon: "Sparkles" },
        ],
      };
    case "testimonials":
      return {
        id,
        type: "testimonials",
        heading: "Cosa dicono i clienti",
        items: [
          { quote: "Servizio eccellente, risultati concreti.", author: "Marco R.", role: "Imprenditore" },
        ],
      };
    case "cta":
      return {
        id,
        type: "cta",
        heading: "Pronto a iniziare?",
        subheading: "Contattaci oggi e scopri cosa possiamo fare per te.",
        buttonText: "Richiedi informazioni",
        buttonUrl: "#form",
        backgroundColor: "#2563eb",
        textColor: "#ffffff",
      };
    case "form":
      return { id, type: "form", formId: null, heading: "Lascia i tuoi dati" };
    case "image":
      return { id, type: "image", url: "", alt: "", maxWidth: 800 };
    case "text":
      return {
        id,
        type: "text",
        content: "Scrivi qui il tuo testo.",
        align: "left",
      };
    case "divider":
      return { id, type: "divider" };
    case "footer":
      return {
        id,
        type: "footer",
        text: `© ${new Date().getFullYear()} La tua azienda. Tutti i diritti riservati.`,
      };
    case "logos":
      return {
        id,
        type: "logos",
        heading: "Come visto su",
        items: [
          { name: "Forbes", imageUrl: "" },
          { name: "ELLE", imageUrl: "" },
          { name: "Wired", imageUrl: "" },
        ],
      };
    case "faq":
      return {
        id,
        type: "faq",
        heading: "Domande frequenti",
        items: [
          { question: "Come funziona?", answer: "Compila il form e ti ricontatteremo con tutte le informazioni." },
          { question: "Posso chiedere una consulenza?", answer: "Certo. La prima valutazione è senza impegno." },
        ],
      };
    case "reviews":
      return {
        id,
        type: "reviews",
        heading: "Le opinioni dei clienti",
        averageRating: 4.8,
        ratingCountLabel: "312 recensioni",
        items: [
          { quote: "Esperienza fantastica, assistenza rapida e risultato concreto.", author: "Giulia M.", rating: 5 },
          { quote: "Servizio chiaro e professionale. Lo consiglio.", author: "Luca R.", rating: 5 },
        ],
      };
    case "offer":
      return {
        id,
        type: "offer",
        badgeText: "Più richiesto",
        heading: "Richiedi la tua consulenza",
        priceLabel: "Valutazione gratuita",
        comparePriceLabel: "",
        includes: ["Analisi delle esigenze", "Risposta personalizzata", "Nessun impegno"],
        buttonText: "Richiedi informazioni",
        buttonUrl: "#form",
        backgroundColor: "#0f172a",
        textColor: "#ffffff",
      };
    case "comparison":
      return {
        id,
        type: "comparison",
        heading: "Perché scegliere noi",
        columns: ["La nostra soluzione", "Alternative"],
        highlightColumn: 0,
        rows: [
          { label: "Supporto personalizzato", values: [true, false] },
          { label: "Risposta rapida", values: [true, "Dipende"] },
          { label: "Consulenza iniziale", values: ["Inclusa", "Extra"] },
        ],
      };
    default:
      return assertNever(type);
  }
}

export function emptyLandingConfig(): LandingConfig {
  return {
    blocks: [createBlock("hero"), createBlock("features"), createBlock("cta")],
    theme: { primaryColor: "#2563eb", fontFamily: "Inter, sans-serif", maxWidth: 1100 },
  };
}

export function createFormField(type: FormFieldType): FormField {
  const id = blockId("fld");
  const base = {
    id,
    type,
    options: [] as string[],
    validation: { required: false, min: null, max: null, pattern: null },
  };
  switch (type) {
    case "email":
      return { ...base, label: "Email", placeholder: "you@example.com", crmField: "email", validation: { ...base.validation, required: true } };
    case "phone":
      return { ...base, label: "Telefono", placeholder: "+39 ...", crmField: "phone" };
    case "text":
      return { ...base, label: "Nome", placeholder: "Il tuo nome", crmField: "name" };
    case "textarea":
      return { ...base, label: "Messaggio", placeholder: "Scrivi qui...", crmField: "message" };
    case "select":
      return { ...base, label: "Seleziona", placeholder: "", crmField: "none", options: ["Opzione 1", "Opzione 2"] };
    case "radio":
      return { ...base, label: "Scelta", placeholder: "", crmField: "none", options: ["Sì", "No"] };
    case "checkbox":
      return { ...base, label: "Accetto i termini", placeholder: "", crmField: "none" };
    case "date":
      return { ...base, label: "Data", placeholder: "", crmField: "none" };
    case "number":
      return { ...base, label: "Numero", placeholder: "0", crmField: "budget" };
  }
}

export function defaultFormFields(): FormField[] {
  return [
    createFormField("text"),
    createFormField("email"),
    createFormField("phone"),
    createFormField("textarea"),
  ];
}

export function defaultFormStyle(): FormStyle {
  return { theme: "light", primaryColor: "#2563eb", borderRadius: 8 };
}

function defaultDay(enabled: boolean): DayAvailability {
  return { enabled, start: "09:00", end: "18:00" };
}

export function defaultAvailability(): BookingAvailability {
  const days = {} as Record<WeekdayKey, DayAvailability>;
  for (const k of WEEKDAY_KEYS) {
    days[k] = defaultDay(k !== "sat" && k !== "sun");
  }
  return { days, bufferBefore: 0, bufferAfter: 0, maxPerDay: 10 };
}
