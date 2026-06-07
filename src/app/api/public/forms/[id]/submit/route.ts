import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getForm } from "@/lib/db";
import { ingestLead } from "@/lib/capture/ingest";
import { clientIp } from "@/lib/capture/analytics";
import { rateLimit } from "@/lib/capture/rate-limit";
import { triggerWorkflows } from "@/lib/workflows/trigger";
import { corsHeaders } from "@/lib/cors";
import type { FormField } from "@/lib/capture/types";

const BodySchema = z.object({
  values: z.record(z.string(), z.unknown()).optional(),
  landingPageId: z.string().optional(),
  funnelId: z.string().optional(),
  sessionId: z.string().optional(),
});

function parseFields(raw: string): FormField[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FormField[]) : [];
  } catch {
    return [];
  }
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === false || (typeof v === "string" && !v.trim());
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ip = clientIp(request.headers) ?? "unknown";
  if (!(await rateLimit(`forms:${ip}`))) {
    return NextResponse.json(
      { success: false, error: "Troppe richieste. Riprova più tardi." },
      { status: 429 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON invalido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const body = parsed.data as Record<string, unknown>;

  const form = await getForm(id);
  if (!form || form.status !== "active") {
    return NextResponse.json({ success: false, error: "Form non trovato" }, { status: 404 });
  }

  const fields = parseFields(form.fields);
  const values =
    body.values && typeof body.values === "object" && !Array.isArray(body.values)
      ? (body.values as Record<string, unknown>)
      : {};

  // Server-side required validation — never trust the client.
  for (const f of fields) {
    if (f.validation?.required && isEmpty(values[f.id])) {
      return NextResponse.json(
        { success: false, error: `Campo obbligatorio: ${f.label}` },
        { status: 400 },
      );
    }
  }

  // Map each field's value to its CRM target; keep a human-readable raw record.
  const mapped: Record<string, string> = {};
  const rawData: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.id];
    if (isEmpty(v)) continue;
    rawData[f.label || f.id] = v;
    if (f.crmField && f.crmField !== "none") {
      mapped[f.crmField] = typeof v === "string" ? v : String(v);
    }
  }

  if (!mapped.name && !mapped.email && !mapped.phone) {
    return NextResponse.json(
      { success: false, error: "Il form deve raccogliere almeno nome, email o telefono." },
      { status: 400 },
    );
  }

  const str = (k: string): string | null => {
    const v = body[k];
    return typeof v === "string" && v.trim().length ? v.trim() : null;
  };

  try {
    const { lead, duplicate } = await ingestLead(
      {
        name: mapped.name ?? null,
        email: mapped.email ?? null,
        phone: mapped.phone ?? null,
        company: mapped.company ?? null,
        website: mapped.website ?? null,
        message: mapped.message ?? null,
        budget: mapped.budget ?? null,
        source: "form",
        formId: id,
        landingPageId: str("landingPageId"),
        funnelId: str("funnelId"),
        rawData,
      },
      {
        ip,
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
        sessionId: str("sessionId"),
      },
    );

    await triggerWorkflows(
      "form_submitted",
      {
        formId: id,
        leadId: lead.id,
        contactId: lead.contactId,
        duplicate,
        name: mapped.name ?? null,
        email: mapped.email ?? null,
        phone: mapped.phone ?? null,
        company: mapped.company ?? null,
        message: mapped.message ?? null,
      },
      `form_submitted:${lead.id}`,
    );

    return NextResponse.json(
      {
        success: true,
        duplicate,
        successMessage: form.successMessage,
        redirectUrl: form.redirectUrl,
      },
      {
        status: 201,
        headers: corsHeaders(request),
      },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Errore durante l'invio. Riprova." },
      { status: 500 },
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: corsHeaders(request),
  });
}
