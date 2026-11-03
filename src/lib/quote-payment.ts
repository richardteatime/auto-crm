// ---------------------------------------------------------------------------
// Quote payment terms: options, (de)serialisation and payment schedule.
// Shared by the quote form (live preview) and the PDF renderer.
// Amounts are in cents.
// ---------------------------------------------------------------------------

export type PaymentMethod =
  | "consegna"
  | "anticipato"
  | "30gg"
  | "60gg"
  | "rate"
  | "acconto_saldo"
  | "personalizzato";

export interface PaymentTerms {
  method: PaymentMethod;
  /** Number of monthly instalments (method "rate"). */
  installments?: number;
  /** Deposit percentage (method "acconto_saldo"). */
  depositPercent?: number;
  /** Free text (method "personalizzato", or extra notes for any method). */
  customText?: string;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "consegna", label: "Unica soluzione alla consegna" },
  { value: "anticipato", label: "Unica soluzione all'accettazione" },
  { value: "30gg", label: "30 giorni data fattura" },
  { value: "60gg", label: "60 giorni data fattura" },
  { value: "rate", label: "Dilazionato in rate mensili" },
  { value: "acconto_saldo", label: "Acconto + saldo alla consegna" },
  { value: "personalizzato", label: "Personalizzato" },
];

export const INSTALLMENT_OPTIONS = [2, 3, 4, 6, 10, 12];
export const DEPOSIT_OPTIONS = [20, 30, 40, 50];

export const DEFAULT_PAYMENT_TERMS: PaymentTerms = { method: "consegna" };

const METHOD_VALUES = new Set<string>(PAYMENT_METHODS.map((m) => m.value));

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Normalise any input (JSON string, object, null) into valid terms, or null. */
export function parsePaymentTerms(raw: unknown): PaymentTerms | null {
  if (raw == null || raw === "") return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.method !== "string" || !METHOD_VALUES.has(o.method)) return null;

  const method = o.method as PaymentMethod;
  const terms: PaymentTerms = { method };
  if (method === "rate") terms.installments = clampInt(o.installments, 2, 24, 3);
  if (method === "acconto_saldo") terms.depositPercent = clampInt(o.depositPercent, 1, 99, 50);
  const text = typeof o.customText === "string" ? o.customText.trim().slice(0, 1500) : "";
  if (text) terms.customText = text;
  return terms;
}

export function serializePaymentTerms(terms: PaymentTerms | null): string | null {
  const t = parsePaymentTerms(terms);
  return t ? JSON.stringify(t) : null;
}

/** One-line human description, e.g. "Dilazionato in 3 rate mensili". */
export function describePaymentTerms(terms: PaymentTerms): string {
  switch (terms.method) {
    case "consegna":
      return "Pagamento in unica soluzione alla consegna del lavoro.";
    case "anticipato":
      return "Pagamento in unica soluzione all'accettazione del preventivo.";
    case "30gg":
      return "Pagamento a 30 giorni data fattura.";
    case "60gg":
      return "Pagamento a 60 giorni data fattura.";
    case "rate": {
      const n = terms.installments ?? 3;
      return `Pagamento dilazionato in ${n} rate mensili di pari importo: la prima all'avvio dei lavori, le successive ogni 30 giorni.`;
    }
    case "acconto_saldo": {
      const p = terms.depositPercent ?? 50;
      return `Acconto del ${p}% all'accettazione del preventivo, saldo del ${100 - p}% alla consegna del lavoro.`;
    }
    case "personalizzato":
      return terms.customText || "Modalità concordata con il cliente.";
  }
}

export interface ScheduleRow {
  label: string;
  amount: number; // cents
}

/** Split `total` cents into `parts` amounts; the last absorbs rounding. */
function split(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const out = Array.from({ length: parts }, () => base);
  out[parts - 1] = total - base * (parts - 1);
  return out;
}

/**
 * Payment schedule for the one-off part of the quote (VAT included).
 * Recurring fees are billed on their own cadence and are not split here.
 */
export function buildPaymentSchedule(terms: PaymentTerms, oneOffTotal: number): ScheduleRow[] {
  if (oneOffTotal <= 0) return [];
  switch (terms.method) {
    case "consegna":
      return [{ label: "Alla consegna del lavoro", amount: oneOffTotal }];
    case "anticipato":
      return [{ label: "All'accettazione del preventivo", amount: oneOffTotal }];
    case "30gg":
      return [{ label: "A 30 giorni data fattura", amount: oneOffTotal }];
    case "60gg":
      return [{ label: "A 60 giorni data fattura", amount: oneOffTotal }];
    case "rate": {
      const n = terms.installments ?? 3;
      return split(oneOffTotal, n).map((amount, i) => ({
        label:
          i === 0
            ? `1ª rata di ${n} · all'avvio dei lavori`
            : `${i + 1}ª rata di ${n} · a ${i * 30} giorni`,
        amount,
      }));
    }
    case "acconto_saldo": {
      const p = terms.depositPercent ?? 50;
      const deposit = Math.round((oneOffTotal * p) / 100);
      return [
        { label: `Acconto ${p}% · all'accettazione`, amount: deposit },
        { label: `Saldo ${100 - p}% · alla consegna`, amount: oneOffTotal - deposit },
      ];
    }
    case "personalizzato":
      return [];
  }
}
