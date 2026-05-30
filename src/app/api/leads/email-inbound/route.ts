import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db/settings";
import {
  createLead,
  updateLead,
  findDuplicateLead,
  createPipelineMovement,
  type CreateLeadInput,
} from "@/lib/db";
import { parseLeadEmail } from "@/lib/leads/parser";
import { scoreFromParsed, scoreBand } from "@/lib/leads/scoring";
import { fireTrigger } from "@/lib/leads/automation";
import type { Lead, ParsedLead } from "@/lib/leads/types";

// ---------------------------------------------------------------------------
// Inbound lead email → parse → score → dedup → create/update lead.
// External endpoint: no session auth. Protected by optional webhook secret
// (same pattern as /api/webhook) + in-memory IP rate limit.
// NEVER blocks on AI: parseLeadEmail degrades to regex if no provider.
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const EMAIL_IN_FROM = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

// Read the first present key (case-insensitive) from a flat payload.
function pick(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) lower[k.toLowerCase()] = v;
  for (const key of keys) {
    const v = lower[key.toLowerCase()];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

// Normalize the many inbound-email provider shapes into subject/text/html/from.
function normalizeInbound(payload: Record<string, unknown>) {
  return {
    subject: pick(payload, ["subject"]),
    text: pick(payload, [
      "text",
      "body",
      "plain",
      "textbody",
      "body-plain",
      "bodyplain",
      "message",
    ]),
    html: pick(payload, ["html", "htmlbody", "body-html", "bodyhtml"]),
    from: pick(payload, ["from", "sender", "fromemail", "from_email", "email"]),
    formName: pick(payload, ["form", "formname", "form_name", "source"]),
  };
}

// "Marco Rossi <marco@acme.com>" → { name, email }
function parseFrom(from: string | null): { name: string | null; email: string | null } {
  if (!from) return { name: null, email: null };
  const emailMatch = from.match(EMAIL_IN_FROM);
  const email = emailMatch ? emailMatch[0] : null;
  let name: string | null = null;
  const before = from.split("<")[0].trim().replace(/^"|"$/g, "").trim();
  if (before && !before.includes("@")) name = before;
  return { name, email };
}

// Only fill fields that are empty on the existing lead (never overwrite good data).
function buildGapFill(
  existing: Lead,
  parsed: ParsedLead,
  newScore: number,
): Record<string, unknown> {
  const upd: Record<string, unknown> = {};
  const placeholder = existing.fullName === "Lead senza nome";

  const fillIfEmpty = (key: keyof Lead, value: string | null | undefined) => {
    if (value && !existing[key]) upd[key] = value;
  };

  fillIfEmpty("firstName", parsed.firstName);
  fillIfEmpty("lastName", parsed.lastName);
  fillIfEmpty("email", parsed.email);
  fillIfEmpty("phone", parsed.phone);
  fillIfEmpty("company", parsed.company);
  fillIfEmpty("businessName", parsed.businessName);
  fillIfEmpty("website", parsed.website);
  fillIfEmpty("projectType", parsed.projectType);
  fillIfEmpty("message", parsed.message);

  if (parsed.fullName && (placeholder || !existing.fullName)) {
    upd.fullName = parsed.fullName;
  }
  if (
    existing.category === "unknown" &&
    parsed.category &&
    parsed.category !== "unknown"
  ) {
    upd.category = parsed.category;
  }
  if (newScore > existing.leadScore) upd.leadScore = newScore;

  // Merge custom fields (existing wins).
  const incoming = collectCustomFields(parsed);
  if (Object.keys(incoming).length > 0) {
    let current: Record<string, string> = {};
    if (existing.customFields) {
      try {
        current = JSON.parse(existing.customFields) as Record<string, string>;
      } catch {
        current = {};
      }
    }
    let changed = false;
    for (const [k, v] of Object.entries(incoming)) {
      if (!current[k]) {
        current[k] = v;
        changed = true;
      }
    }
    if (changed) upd.customFields = current;
  }

  return upd;
}

// Budget has no dedicated column → preserve it inside customFields.
function collectCustomFields(parsed: ParsedLead): Record<string, string> {
  const cf: Record<string, string> = { ...parsed.customFields };
  if (parsed.budget && !cf.budget) cf.budget = parsed.budget;
  return cf;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova più tardi." },
      { status: 429 },
    );
  }

  // Optional shared-secret auth (mirrors /api/webhook).
  const storedSecret = await getSetting("webhook_secret");
  if (storedSecret) {
    const provided = request.headers.get("x-webhook-secret");
    if (!provided || provided !== storedSecret) {
      return NextResponse.json(
        { error: "Secret non valido o mancante" },
        { status: 401 },
      );
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const inbound = normalizeInbound(payload);
  if (!inbound.subject && !inbound.text && !inbound.html) {
    return NextResponse.json(
      {
        error: "Email vuota: serve almeno 'subject', 'text' o 'html'",
        hint: "Campi supportati: subject, text/body, html, from",
      },
      { status: 400 },
    );
  }

  // Parse (key-value / html / free-text / AI — never throws, never blocks).
  const { parsed, strategy, usedAI } = await parseLeadEmail({
    subject: inbound.subject,
    text: inbound.text,
    html: inbound.html,
  });

  // Fill identity gaps from the From header when the body lacked them.
  const fromParsed = parseFrom(inbound.from);
  if (!parsed.email && fromParsed.email) parsed.email = fromParsed.email;
  if (
    fromParsed.name &&
    (!parsed.fullName || parsed.fullName === "Lead senza nome")
  ) {
    parsed.fullName = fromParsed.name;
  }

  const leadScore = scoreFromParsed(parsed);
  const band = scoreBand(leadScore);

  // Dedup: never create a second lead for a known email/phone/company.
  const duplicate = await findDuplicateLead({
    email: parsed.email,
    phone: parsed.phone,
    company: parsed.company,
  });

  try {
    if (duplicate) {
      const upd = buildGapFill(duplicate, parsed, leadScore);
      if (Object.keys(upd).length > 0) {
        await updateLead(duplicate.id, upd);
      }
      return NextResponse.json(
        {
          success: true,
          action: "updated",
          leadId: duplicate.id,
          fullName: upd.fullName ?? duplicate.fullName,
          email: duplicate.email ?? parsed.email ?? null,
          category: upd.category ?? duplicate.category,
          pipelineStage: duplicate.pipelineStage,
          leadScore: Math.max(leadScore, duplicate.leadScore),
          scoreBand: scoreBand(Math.max(leadScore, duplicate.leadScore)),
          strategy,
          usedAI,
          deduped: true,
        },
        { status: 200 },
      );
    }

    const input: CreateLeadInput = {
      firstName: parsed.firstName ?? null,
      lastName: parsed.lastName ?? null,
      fullName: parsed.fullName || "Lead senza nome",
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      company: parsed.company ?? null,
      businessName: parsed.businessName ?? null,
      website: parsed.website ?? null,
      projectType: parsed.projectType ?? null,
      category: parsed.category ?? "unknown",
      source: "email",
      formName: inbound.formName,
      message: parsed.message ?? null,
      rawSubject: inbound.subject,
      rawBody: inbound.text ?? inbound.html ?? null,
      customFields: collectCustomFields(parsed),
      status: "new",
      pipelineStage: "prospect",
      leadScore,
    };

    const lead = await createLead(input);

    // Every pipeline movement is tracked — a lead is born in "prospect".
    await createPipelineMovement({
      leadId: lead.id,
      fromStage: null,
      toStage: "prospect",
      reason: "lead_created_from_email",
      triggeredBy: "system",
      metadata: { strategy, usedAI, leadScore },
    });

    // Fire the lead_created automation (classify, call task, notify, log).
    // Never throws — the lead already exists regardless of automation outcome.
    const automation = await fireTrigger("lead_created", { leadId: lead.id });

    return NextResponse.json(
      {
        success: true,
        action: "created",
        leadId: lead.id,
        fullName: lead.fullName,
        email: lead.email,
        category: lead.category,
        pipelineStage: lead.pipelineStage,
        leadScore: lead.leadScore,
        scoreBand: band,
        strategy,
        usedAI,
        deduped: false,
        automation: {
          matchedRules: automation.matchedRules,
          runs: automation.runs.length,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: `Errore nella creazione del lead: ${
          error instanceof Error ? error.message : "sconosciuto"
        }`,
      },
      { status: 500 },
    );
  }
}
