import type { LeadCategory, ParsedLead } from "../types";
import { consolidateName } from "./fields";
import { htmlToText, isHtml } from "./html";
import { looksLikeKeyValue, parseKeyValue } from "./key-value";
import { parseFreeText } from "./free-text";
import { extractWithAI, isAIExtractionEnabled } from "./ai-extract";
import {
  categoryFromProjectType,
  classifyCategoryByKeywords,
} from "../categories";

export interface EmailInput {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}

export interface ParseResult {
  parsed: ParsedLead;
  strategy: "key_value" | "free_text" | "ai" | "ai+regex";
  usedAI: boolean;
}

type MergeableLeadField = Exclude<keyof ParsedLead, "customFields">;

const STANDARD_KEYS: MergeableLeadField[] = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "company",
  "businessName",
  "website",
  "projectType",
  "category",
  "budget",
  "message",
];

function fillGap<K extends MergeableLeadField>(
  out: ParsedLead,
  extra: ParsedLead,
  key: K,
): void {
  if (!out[key] && extra[key]) {
    out[key] = extra[key];
  }
}

// base wins; extra fills gaps. customFields are merged.
function merge(base: ParsedLead, extra: ParsedLead): ParsedLead {
  const out: ParsedLead = { ...base, customFields: { ...base.customFields } };
  for (const key of STANDARD_KEYS) {
    fillGap(out, extra, key);
  }
  for (const [k, v] of Object.entries(extra.customFields)) {
    if (!out.customFields[k]) out.customFields[k] = v;
  }
  return out;
}

function applyCategory(result: ParsedLead, subject: string): void {
  if (result.category && result.category !== "unknown") return;

  const fromType = categoryFromProjectType(result.projectType);
  if (fromType) {
    result.category = fromType;
    return;
  }

  result.category = classifyCategoryByKeywords(
    subject,
    result.projectType,
    result.message,
    result.businessName,
    result.company,
  );
}

export async function parseLeadEmail(input: EmailInput): Promise<ParseResult> {
  const subject = (input.subject ?? "").trim();
  const rawText = input.text ?? "";
  const rawHtml = input.html ?? "";

  // Pick a working plain-text body.
  let bodyText = rawText.trim();
  if (!bodyText && rawHtml) bodyText = htmlToText(rawHtml);
  if (!bodyText && isHtml(rawText)) bodyText = htmlToText(rawText);

  let parsed: ParsedLead;
  let strategy: ParseResult["strategy"];
  let usedAI = false;

  if (looksLikeKeyValue(bodyText)) {
    // Structured form email — deterministic parse is reliable.
    parsed = parseKeyValue(bodyText);
    strategy = "key_value";
    // Subject sometimes carries the request line too.
    if (!parsed.message && subject) parsed.message = subject;
  } else {
    // Unstructured → AI first (if available), then regex fallback/merge.
    const regex = parseFreeText(bodyText);
    if (isAIExtractionEnabled()) {
      const ai = await extractWithAI(subject, bodyText);
      if (ai) {
        usedAI = true;
        parsed = merge(ai, regex); // AI wins, regex fills gaps (email/phone)
        strategy = "ai+regex";
      } else {
        parsed = regex;
        strategy = "free_text";
      }
    } else {
      parsed = regex;
      strategy = "free_text";
    }
  }

  consolidateName(parsed);
  applyCategory(parsed, subject);

  if (!parsed.fullName) {
    // Last-resort fullName from email local part or generic placeholder.
    if (parsed.email) {
      parsed.fullName = parsed.email.split("@")[0].replace(/[._]/g, " ");
    } else {
      parsed.fullName = "Lead senza nome";
    }
    consolidateName(parsed);
  }

  if (!parsed.category) parsed.category = "unknown" as LeadCategory;

  return { parsed, strategy, usedAI };
}

export { htmlToText, parseKeyValue, parseFreeText };
