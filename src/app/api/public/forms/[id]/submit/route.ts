import { NextRequest, NextResponse } from "next/server";
import { getForm } from "@/lib/db";
import { ingestLead } from "@/lib/capture/ingest";
import { clientIp } from "@/lib/capture/analytics";
import { rateLimit } from "@/lib/capture/rate-limit";
import { triggerWorkflows } from "@/lib/workflows/trigger";
import type { FormField } from "@/lib/capture/types";

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
  if (!rateLimit(`forms:${ip}`)) {
    return NextResponse.json(
      { success: false, error: "Troppe richieste. Riprova più tardi." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON invalido" }, { status: 400 });
  }

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

    triggerWorkflows("form_submitted", {
      formId: id,
      leadId: lead.id,
      contactId: lead.contactId,
      duplicate,
      name: mapped.name ?? null,
      email: mapped.email ?? null,
      phone: mapped.phone ?? null,
      company: mapped.company ?? null,
      message: mapped.message ?? null,
    });

    return NextResponse.json(
      {
        success: true,
        duplicate,
        successMessage: form.successMessage,
        redirectUrl: form.redirectUrl,
      },
      {
        status: 201,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Errore durante l'invio. Riprova." },
      { status: 500 },
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
