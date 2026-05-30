import type { ParsedLead } from "../types";

export type StandardField =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "company"
  | "businessName"
  | "website"
  | "projectType"
  | "budget"
  | "message";

// Normalized key (lowercase, spaces→_, no accents) → standard field
export const FIELD_ALIASES: Record<string, StandardField> = {
  // first name
  nome: "firstName",
  first_name: "firstName",
  firstname: "firstName",
  primer_nombre: "firstName",
  // last name
  cognome: "lastName",
  last_name: "lastName",
  lastname: "lastName",
  surname: "lastName",
  apellido: "lastName",
  // full name
  nome_completo: "fullName",
  full_name: "fullName",
  fullname: "fullName",
  name: "fullName",
  nominativo: "fullName",
  // email
  email: "email",
  "e_mail": "email",
  mail: "email",
  correo: "email",
  indirizzo_email: "email",
  email_address: "email",
  // phone
  telefono: "phone",
  tel: "phone",
  cellulare: "phone",
  cell: "phone",
  phone: "phone",
  mobile: "phone",
  whatsapp: "phone",
  numero: "phone",
  numero_di_telefono: "phone",
  phone_number: "phone",
  // company
  azienda: "company",
  ditta: "company",
  company: "company",
  societa: "company",
  organizzazione: "company",
  company_name: "company",
  // business name
  nome_attivita: "businessName",
  attivita: "businessName",
  business_name: "businessName",
  ragione_sociale: "businessName",
  nome_azienda: "businessName",
  nome_negozio: "businessName",
  // website
  sito: "website",
  website: "website",
  sito_web: "website",
  url: "website",
  web: "website",
  // project type
  tipo_progetto: "projectType",
  tipo_di_progetto: "projectType",
  project_type: "projectType",
  servizio: "projectType",
  tipologia: "projectType",
  tipo: "projectType",
  // budget
  budget: "budget",
  budget_indicativo: "budget",
  importo: "budget",
  spesa_prevista: "budget",
  preventivo: "budget",
  // message
  messaggio: "message",
  richiesta: "message",
  message: "message",
  request: "message",
  descrizione: "message",
  note: "message",
  dettagli: "message",
  mensaje: "message",
  comments: "message",
  commenti: "message",
};

export function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function emptyParsed(): ParsedLead {
  return { customFields: {} };
}

// Assign a key/value into a ParsedLead. Unknown keys go to customFields.
export function assignField(
  result: ParsedLead,
  rawKey: string,
  rawValue: string,
): void {
  const value = rawValue.trim();
  if (!value) return;

  const key = normalizeKey(rawKey);
  if (!key) return;

  const field = FIELD_ALIASES[key];
  if (field) {
    if (!result[field]) {
      result[field] = value;
    }
  } else {
    if (!result.customFields[key]) {
      result.customFields[key] = value;
    }
  }
}

// Build fullName from first/last if missing.
export function consolidateName(result: ParsedLead): void {
  if (!result.fullName) {
    const parts = [result.firstName, result.lastName].filter(Boolean);
    if (parts.length > 0) result.fullName = parts.join(" ").trim();
  }
  // If we have fullName but not first/last, split it.
  if (result.fullName && !result.firstName) {
    const parts = result.fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      result.firstName = parts[0];
      result.lastName = parts.slice(1).join(" ");
    } else {
      result.firstName = result.fullName;
    }
  }
}
