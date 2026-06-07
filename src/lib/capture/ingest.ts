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
import type { Lead, LeadCategory } from "@/lib/leads/types";
import { normalizeContactSource } from "@/lib/db/contact-source";
import { computeLeadScore } from "@/lib/leads/scoring";
import { fireTrigger } from "@/lib/leads/automation";
import {
  categoryFromProjectType,
  classifyCategoryByKeywords,
} from "@/lib/leads/categories";

export interface IngestLeadInput {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  website?: string | null;
  projectType?: string | null;
  category?: LeadCategory | null;
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

function resolveCategory(
  input: IngestLeadInput,
  message: string | null,
  company: string | null,
): LeadCategory {
  if (input.category && input.category !== "unknown") return input.category;
  return (
    categoryFromProjectType(trimOrNull(input.projectType)) ??
    classifyCategoryByKeywords(input.projectType, message, company)
  );
}

function mergeCaptureCustomFields(
  current: string | null | undefined,
  input: IngestLeadInput,
): Record<string, string> | null {
  let merged: Record<string, string> = {};
  if (current) {
    try {
      const parsed = JSON.parse(current) as Record<string, unknown>;
      merged = Object.fromEntries(
        Object.entries(parsed)
          .filter(([, value]) => typeof value === "string" || typeof value === "number")
          .map(([key, value]) => [key, String(value)]),
      );
    } catch {
      merged = {};
    }
  }
  const budget = trimOrNull(input.budget);
  if (budget && !merged.budget) merged.budget = budget;
  return Object.keys(merged).length ? merged : null;
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
    source: normalizeContactSource(input.source),
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
  const projectType = trimOrNull(input.projectType);
  const message = trimOrNull(input.message);
  const category = resolveCategory(input, message, company);
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
    const patch: Record<string, unknown> = {};
    if (!existing.email && email) patch.email = email;
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.company && company) patch.company = company;
    if (!existing.website && website) patch.website = website;
    if (!existing.projectType && projectType) patch.projectType = projectType;
    if (existing.category === "unknown" && category !== "unknown") patch.category = category;
    if (!existing.landingPageId && landingPageId) patch.landingPageId = landingPageId;
    if (!existing.formId && formId) patch.formId = formId;
    if (!existing.funnelId && funnelId) patch.funnelId = funnelId;
    if (!existing.bookingLinkId && bookingLinkId) patch.bookingLinkId = bookingLinkId;
    if (!existing.contactId) patch.contactId = contactId;
    const customFields = mergeCaptureCustomFields(existing.customFields, input);
    if (customFields && JSON.stringify(customFields) !== existing.customFields) {
      patch.customFields = customFields;
    }

    // Riattiva un lead chiuso che torna con una nuova submission.
    if (existing.status === "lost" || existing.status === "won") {
      patch.status = "working";
      patch.pipelineStage = "prospect";
    }

    // Forza l'aggiornamento della data così il lead sale in cima alla pipeline
    // e il workflow vede che è stato toccato di recente.
    patch.updatedAt = new Date().toISOString();

    // Ricalcola score con i dati aggiornati
    patch.leadScore = computeLeadScore({
      email: existing.email || email,
      phone: existing.phone || phone,
      message: existing.message || message,
      budget: customFields?.budget ?? trimOrNull(input.budget),
      category: existing.category === "unknown" ? category : existing.category,
    });

    lead = Object.keys(patch).length
      ? await updateLead(existing.id, patch)
      : existing;
  } else {
    const leadScore = computeLeadScore({
      email,
      phone,
      message,
      budget: trimOrNull(input.budget),
      category,
    });

    lead = await createLead({
      fullName,
      firstName: trimOrNull(input.firstName),
      lastName: trimOrNull(input.lastName),
      email,
      phone,
      company,
      website,
      projectType,
      category,
      message,
      customFields: mergeCaptureCustomFields(null, input),
      source,
      status: "new",
      pipelineStage: "prospect",
      leadScore,
      contactId,
      landingPageId,
      formId,
      funnelId,
      bookingLinkId,
    });

    // Public Capture must enter the same automation pipeline as email intake.
    // Await the internal engine so serverless runtimes cannot terminate before
    // the Leo call task and audit run are persisted. Automation failures are
    // isolated by the engine and must never lose the captured lead.
    await fireTrigger("lead_created", { leadId: lead.id });
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
    "projectType",
    "message",
    "budget",
  ] as const) {
    const v = trimOrNull(input[key]);
    if (v) out[key] = v;
  }
  return out;
}
