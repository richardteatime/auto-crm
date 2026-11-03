import { createHash, timingSafeEqual } from "crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";

// Lead intake, ported from Solead (lead-agent core/intake.ts) without the AI/WhatsApp part.
// Accepts Meta Instant Forms payloads as Make/Zapier/n8n forward them:
//   - Graph API shape: field_data: [{ name, values: [] }]
//   - answers: [{ question, answer }]
//   - flat fields (Make "Facebook Lead Ads > Watch Leads" exposes form fields as named keys)
// Standard fields map onto the Lead; everything else is kept in formData so the salesperson sees it.

const NAME_KEYS = ["full_name", "fullName", "nome_e_cognome", "nome_completo"];
const PHONE_KEYS = ["phone_number", "phoneNumber", "phone", "telefono", "cellulare", "mobile_number", "mobileNumber", "whatsapp", "tel"];
const EMAIL_KEYS = ["email", "e_mail", "mail", "email_address"];
const COMPANY_KEYS = ["company_name", "companyName", "company", "azienda", "societa", "ragione_sociale", "nome_azienda"];
const SERVICE_KEYS = ["servizio", "service", "quale_servizio", "quale_servizio_ti_interessa", "di_cosa_hai_bisogno", "interesse"];
const CONTEXT_KEYS = ["form_id", "formId", "form_name", "formName", "page_id", "pageId", "page_name", "pageName", "campaign_id", "campaignId", "campaign_name", "campaignName", "adset_id", "adsetId", "adset_name", "adsetName", "ad_id", "adId", "ad_name", "adName", "adgroup_id", "adgroupId", "adgroup_name", "adgroupName", "is_organic", "isOrganic", "platform", "created_time", "createdTime", "source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const ID_KEYS = ["id", "lead_id", "leadId", "leadgen_id", "external_id"];
/** "Phone Number", "phone-number", "Telefono:" → "phone_number", "telefono" */
export const canonKey = (k: string) =>
  k
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const MAPPED_RAW = [...NAME_KEYS, "first_name", "firstName", "last_name", "lastName", "name", "nome", "cognome", ...PHONE_KEYS, ...EMAIL_KEYS, ...COMPANY_KEYS, ...ID_KEYS, ...CONTEXT_KEYS, "field_data", "fieldData", "answers", "bundle", "lead", "consent", "privacy"];
const MAPPED = new Set(MAPPED_RAW.map(canonKey));
const isMapped = (k: string) => MAPPED.has(canonKey(k));

const looksLikePhoneKey = (k: string) => /telefon|phone|cellular|mobile|whats/i.test(k);
const looksLikePhone = (v: string) => {
  const d = v.replace(/[^\d+]/g, "");
  return /[0-9]/.test(v) && d.length >= 6 && d.length <= 20;
};
const looksLikeServiceKey = (k: string) => /servizi|service|interess|bisogno|progett/i.test(k);

export interface NormalizedLead {
  externalId: string;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  service: string | null;
  context: {
    form?: string;
    page?: string;
    campaign?: string;
    adset?: string;
    ad?: string;
    platform?: string;
    is_organic?: string;
    created_time?: string;
    utm?: string;
  };
  formData: Record<string, unknown>;
}

type Dict = Record<string, unknown>;

/** Pure: any payload → lead fields. Idempotency key = Meta lead id, else a stable content hash. */
export function normalizeIntakePayload(body: unknown): NormalizedLead {
  const src = (body && typeof body === "object" ? body : {}) as Dict;
  const nested = (key: string): Dict => {
    const o = src[key];
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Dict) : {};
  };
  const merged: Dict = { ...nested("lead"), ...nested("bundle"), ...src };

  const f: Record<string, string> = {};
  const push = (k: unknown, v: unknown) => {
    if (typeof k !== "string" || !k.trim()) return;
    if (v === null || v === undefined || v === "") return;
    const s = Array.isArray(v) ? v.map(String).join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (!s.trim()) return;
    f[k.trim()] = s.trim();
  };
  const fieldData = Array.isArray(merged.field_data) ? merged.field_data : Array.isArray(merged.fieldData) ? merged.fieldData : [];
  for (const fd of fieldData) {
    if (fd && typeof fd === "object") push((fd as Dict).name, (fd as Dict).values ?? (fd as Dict).value);
  }
  for (const a of Array.isArray(merged.answers) ? merged.answers : []) {
    if (a && typeof a === "object") {
      const o = a as Dict;
      push(o.question ?? o.question_id ?? o.name, o.answer ?? o.answers ?? o.values);
    }
  }
  for (const [k, v] of Object.entries(merged)) {
    if (v === null || v === undefined || typeof v === "object") continue;
    push(k, v);
  }

  // Lookup by canonical key, so "Full Name" / "full-name" / "full_name" all match
  const byCanon = new Map<string, string>();
  for (const [k, v] of Object.entries(f)) if (!byCanon.has(canonKey(k))) byCanon.set(canonKey(k), v);
  const pick = (keys: string[]) => {
    for (const k of keys) {
      const v = byCanon.get(canonKey(k));
      if (v) return v;
    }
    return null;
  };

  let name = pick(NAME_KEYS) ?? pick(["name", "nome"]);
  const first = pick(["first_name"]);
  const last = pick(["last_name", "cognome"]);
  if (!name && (first || last)) name = [first, last].filter(Boolean).join(" ");
  else if (name && last && !name.includes(last)) name = `${name} ${last}`;

  let phone = pick(PHONE_KEYS) ?? "";
  let phoneFromCustomKey: string | null = null;
  if (!phone) {
    for (const [k, v] of Object.entries(f)) {
      if (!isMapped(k) && looksLikePhoneKey(k) && looksLikePhone(v)) {
        phone = v;
        phoneFromCustomKey = k;
        break;
      }
    }
  }
  const email = pick(EMAIL_KEYS);
  const company = pick(COMPANY_KEYS);
  let service = pick(SERVICE_KEYS);
  if (!service) {
    for (const [k, v] of Object.entries(f)) {
      if (!isMapped(k) && looksLikeServiceKey(k)) {
        service = v;
        break;
      }
    }
  }

  const ctx: NormalizedLead["context"] = {};
  const p = (...keys: string[]) => pick(keys) ?? undefined;
  ctx.form = p("form_name", "formName", "form_id", "formId");
  ctx.page = p("page_name", "pageName", "page_id", "pageId");
  ctx.campaign = p("campaign_name", "campaignName", "utm_campaign", "campaign_id", "campaignId");
  ctx.adset = p("adset_name", "adsetName", "adgroup_name", "adgroupName", "adset_id", "adsetId", "adgroup_id", "adgroupId");
  ctx.ad = p("ad_name", "adName", "utm_content", "ad_id", "adId");
  ctx.platform = p("platform");
  ctx.is_organic = p("is_organic", "isOrganic");
  ctx.created_time = p("created_time", "createdTime");
  const utm = ["utm_source", "utm_medium", "utm_term"].filter((k) => f[k]).map((k) => `${k}=${f[k]}`).join(" ");
  if (utm) ctx.utm = utm;
  for (const k of Object.keys(ctx) as Array<keyof typeof ctx>) if (!ctx[k]) delete ctx[k];

  const formData: Record<string, unknown> = {};
  if (Object.keys(ctx).length) formData.source = ctx;
  for (const [k, v] of Object.entries(f)) {
    if (isMapped(k) || k === phoneFromCustomKey) continue;
    formData[k] = v;
  }

  let externalId: string | null = null;
  for (const k of ID_KEYS) {
    const v = merged[k];
    if (v !== undefined && v !== null && v !== "") {
      externalId = String(v);
      break;
    }
  }
  if (!externalId) {
    const material = JSON.stringify([name, phone, email, company, formData]);
    externalId = "hash_" + createHash("sha256").update(material).digest("hex").slice(0, 32);
  }

  return { externalId: externalId.slice(0, 128), name, phone, email, company, service, context: ctx, formData };
}

/** "+39 333 123 4567", "0039…", "3331234567" → "+393331234567"; null if not a valid number */
export function normalizePhone(raw: string | null | undefined, defaultCountry = "IT"): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^00/, "+");
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry as "IT");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** Constant-time check of the shared intake secret (env LEAD_INTAKE_SECRET) */
export function checkIntakeSecret(presented: string | null | undefined): boolean {
  const expected = process.env.LEAD_INTAKE_SECRET || "";
  if (!expected || !presented) return false;
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
