// Shared public lead ingestion. Every capture surface (landing page, form,
// funnel, booking) funnels conversions through here so that:
//   1. Each lead carries its origin (source + landingPageId/formId/funnelId/bookingLinkId).
//   2. Duplicates (same email or phone) are reused, never re-created.
//   3. The raw submission is persisted and analytics counters are bumped.
//
// Lead creation is the source of truth and is allowed to throw. Everything
// after it (submission record, counters, analytics) is best-effort and must
// never block the conversion.

import {
  createLead,
  findDuplicateLead,
  updateLead,
  findContactByEmailOrPhone,
  createContact,
  updateContact,
  createFormSubmission,
  incrementLandingCounter,
} from "@/lib/db";
import { track, hashIp } from "@/lib/capture/analytics";
import type { Lead } from "@/lib/leads/types";

export interface IngestLeadInput {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  website?: string | null;
  message?: string | null;
  budget?: string | null;
  source?: string | null;
  landingPageId?: string | null;
  formId?: string | null;
  funnelId?: string | null;
  bookingLinkId?: string | null;
  contactId?: string | null;
  // Full submitted payload, stored verbatim on the form submission record.
  rawData?: Record<string, unknown> | null;
}

export interface IngestContext {
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  sessionId?: string | null;
}

export interface IngestResult {
  lead: Lead;
  duplicate: boolean;
}

function trimOrNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

function buildFullName(input: IngestLeadInput): string {
  const explicit = trimOrNull(input.name);
  if (explicit) return explicit;
  const composed = [trimOrNull(input.firstName), trimOrNull(input.lastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (composed) return composed;
  const email = trimOrNull(input.email);
  if (email) return email.split("@")[0];
  const phone = trimOrNull(input.phone);
  if (phone) return phone;
  return "Lead senza nome";
}

function resolveSource(input: IngestLeadInput): string {
  const explicit = trimOrNull(input.source);
  if (explicit) return explicit;
  if (input.landingPageId) return "landing";
  if (input.funnelId) return "funnel";
  if (input.bookingLinkId) return "booking";
  if (input.formId) return "form";
  return "form";
}

function contactSource(source: string): string {
  if (source === "booking") return "evento";
  if (source === "form") return "formulario";
  if (source === "landing" || source === "funnel") return "website";
  return "otro";
}

async function ensureCaptureContact(input: {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: string;
  contactId: string | null;
}): Promise<string> {
  if (input.contactId) return input.contactId;

  const existing = await findContactByEmailOrPhone({
    email: input.email,
    phone: input.phone,
  });
  if (existing) {
    const patch: Record<string, string> = {};
    if (!existing.email && input.email) patch.email = input.email;
    if (!existing.phone && input.phone) patch.phone = input.phone;
    if (!existing.company && input.company) patch.company = input.company;
    if (!existing.notes && input.message) patch.notes = input.message;
    if (Object.keys(patch).length > 0) await updateContact(existing.id, patch);
    return existing.id;
  }

  const created = await createContact({
    name: input.name,
    email: input.email,
    phone: input.phone,
    company: input.company,
    source: contactSource(input.source),
    notes: input.message,
  });
  return created.id;
}

export async function ingestLead(
  input: IngestLeadInput,
  ctx: IngestContext = {},
): Promise<IngestResult> {
  const email = trimOrNull(input.email);
  const phone = trimOrNull(input.phone);
  const company = trimOrNull(input.company);
  const website = trimOrNull(input.website);
  const message = trimOrNull(input.message);
  const source = resolveSource(input);
  const fullName = buildFullName(input);

  const landingPageId = trimOrNull(input.landingPageId);
  const formId = trimOrNull(input.formId);
  const funnelId = trimOrNull(input.funnelId);
  const bookingLinkId = trimOrNull(input.bookingLinkId);

  const existing = await findDuplicateLead({ email, phone });
  const contactId = await ensureCaptureContact({
    name: fullName,
    email,
    phone,
    company,
    message,
    source,
    contactId: trimOrNull(input.contactId) ?? existing?.contactId ?? null,
  });

  let lead: Lead;
  const duplicate = Boolean(existing);

  if (existing) {
    // Fill in only the gaps — never overwrite known data on an existing lead.
    const patch: Record<string, string> = {};
    if (!existing.email && email) patch.email = email;
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.company && company) patch.company = company;
    if (!existing.website && website) patch.website = website;
    if (!existing.landingPageId && landingPageId) patch.landingPageId = landingPageId;
    if (!existing.formId && formId) patch.formId = formId;
    if (!existing.funnelId && funnelId) patch.funnelId = funnelId;
    if (!existing.bookingLinkId && bookingLinkId) patch.bookingLinkId = bookingLinkId;
    if (!existing.contactId) patch.contactId = contactId;

    lead = Object.keys(patch).length
      ? await updateLead(existing.id, patch)
      : existing;
  } else {
    lead = await createLead({
      fullName,
      firstName: trimOrNull(input.firstName),
      lastName: trimOrNull(input.lastName),
      email,
      phone,
      company,
      website,
      message,
      source,
      status: "new",
      pipelineStage: "prospect",
      contactId,
      landingPageId,
      formId,
      funnelId,
      bookingLinkId,
    });
  }

  // Everything below is best-effort; a failure here must not lose the lead.
  try {
    if (formId) {
      await createFormSubmission({
        formId,
        landingPageId,
        funnelId,
        contactId: lead.contactId ?? null,
        data: input.rawData ?? collectKnownFields(input),
        ipHash: hashIp(ctx.ip),
        userAgent: ctx.userAgent ?? null,
        referrer: ctx.referrer ?? null,
      });
      await track("form_submit", "form", formId, ctx);
    }

    if (landingPageId) {
      await incrementLandingCounter(landingPageId, "submissions");
      if (!formId) await track("form_submit", "landing", landingPageId, ctx);
    }
  } catch {
    // Submission/analytics failures stay invisible to the visitor.
  }

  return { lead, duplicate };
}

function collectKnownFields(input: IngestLeadInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of [
    "name",
    "firstName",
    "lastName",
    "email",
    "phone",
    "company",
    "website",
    "message",
    "budget",
  ] as const) {
    const v = trimOrNull(input[key]);
    if (v) out[key] = v;
  }
  return out;
}
