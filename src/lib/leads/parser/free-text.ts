import type { ParsedLead } from "../types";
import { consolidateName, emptyParsed } from "./fields";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// International-ish phone: optional +, digits/spaces/dashes/parens, 7-15 digits.
const PHONE_RE = /(\+?\d[\d\s().-]{6,20}\d)/;
const URL_RE = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i;
const BUDGET_RE = /(?:budget|importo|spesa)\D{0,10}(\d{2,3}(?:[.,]?\d{3})*)/i;

// Try to pull a person name from intros like "sono Marco Rossi" / "mi chiamo X".
const NAME_INTRO_RE =
  /(?:sono|mi chiamo|mi chiamano|name is|i am|i'm|chiamo)\s+([A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+)?)/u;

// Parse unstructured free text using regex. Best-effort fallback.
export function parseFreeText(text: string): ParsedLead {
  const result = emptyParsed();
  if (!text) return result;

  const email = text.match(EMAIL_RE);
  if (email) result.email = email[0];

  const phone = text.match(PHONE_RE);
  if (phone) {
    const digits = phone[1].replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length >= 7) result.phone = phone[1].trim();
  }

  const name = text.match(NAME_INTRO_RE);
  if (name) result.fullName = name[1].trim();

  const budget = text.match(BUDGET_RE);
  if (budget) result.budget = budget[1];

  // website: only if it's not the email's domain
  const url = text.match(URL_RE);
  if (url && (!email || !url[0].includes(email[0].split("@")[1]))) {
    const candidate = url[0];
    if (!candidate.includes("@")) result.website = candidate;
  }

  // The whole text becomes the message.
  result.message = text.trim();

  consolidateName(result);
  return result;
}
