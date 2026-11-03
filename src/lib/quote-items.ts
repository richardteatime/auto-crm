// ---------------------------------------------------------------------------
// Quote line items as stored in the `items` JSON column (prices in cents).
// ---------------------------------------------------------------------------

export type BillingType = "una_tantum" | "mensile" | "annuale";

export interface DbQuoteItem {
  id: string;
  /** Short service name, e.g. "Restyling sito web". */
  description: string;
  /** Long description of what the service includes (shown under the name). */
  details?: string;
  quantity: number;
  unitPrice: number; // cents
  discount?: number; // %
  billingType?: BillingType;
  isSetup?: boolean;
}

/** Form-side item: same shape, price in euros. */
export interface FormQuoteItem {
  id: string;
  description: string;
  details?: string;
  quantity: number;
  unitPrice: number; // EUR
  discount: number;
  billingType: BillingType;
  isSetup?: boolean;
}

export function parseDbItems(itemsJson: string | null | undefined): DbQuoteItem[] {
  if (!itemsJson) return [];
  try {
    const parsed = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? (parsed as DbQuoteItem[]) : [];
  } catch {
    return [];
  }
}

export function parseItemsForForm(itemsJson: string | null | undefined): FormQuoteItem[] {
  return parseDbItems(itemsJson).map((i) => ({
    id: i.id,
    description: i.description ?? "",
    details: i.details ?? "",
    quantity: Number(i.quantity) || 1,
    unitPrice: (Number(i.unitPrice) || 0) / 100,
    discount: i.discount ?? 0,
    billingType: i.billingType ?? "una_tantum",
    isSetup: i.isSetup,
  }));
}

/** Normalise a service name for matching ("Sviluppo  Sito Web " → "sviluppo sito web"). */
export function normalizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
