import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestLead } from "@/lib/capture/ingest";
import { clientIp } from "@/lib/capture/analytics";
import { getSetting } from "@/lib/db/settings";
import { triggerWorkflows } from "@/lib/workflows/trigger";
import { corsHeaders } from "@/lib/cors";

// Simple in-memory rate limiter: max 30 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const WEBHOOK_RATE_LIMIT = 30;
const WEBHOOK_WINDOW_MS = 60_000;

const BodySchema = z.record(z.string(), z.unknown());

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WEBHOOK_WINDOW_MS });
    return true;
  }
  if (entry.count >= WEBHOOK_RATE_LIMIT) {
    return false;
  }
  entry.count++;
  return true;
}

// Field name mapping: common variations → standard field
const FIELD_MAP: Record<string, string> = {
  // Name
  name: "name",
  nombre: "name",
  full_name: "name",
  fullname: "name",
  first_name: "name",
  nombre_completo: "name",
  // Email
  email: "email",
  correo: "email",
  email_address: "email",
  correo_electronico: "email",
  // Phone
  phone: "phone",
  telefono: "phone",
  phone_number: "phone",
  cel: "phone",
  celular: "phone",
  whatsapp: "phone",
  movil: "phone",
  // Company
  company: "company",
  empresa: "company",
  company_name: "company",
  negocio: "company",
  organizacion: "company",
  // Notes
  notes: "notes",
  notas: "notes",
  message: "notes",
  mensaje: "notes",
  comments: "notes",
  comentarios: "notes",
  descripcion: "notes",
};

function extractFields(
  payload: Record<string, unknown>,
): Record<string, string> {
  // Handle Typeform-style nested data
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : payload;

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, "_");
    const mappedField = FIELD_MAP[normalizedKey];
    if (mappedField && !result[mappedField]) {
      result[mappedField] = String(value).trim();
    }
  }

  // Handle "first_name + last_name" pattern
  if (!result.name) {
    const firstName =
      data.first_name || data.nombre || data.firstName || data.primer_nombre;
    const lastName =
      data.last_name || data.apellido || data.lastName || data.apellidos;
    if (firstName) {
      result.name = [firstName, lastName].filter(Boolean).join(" ").trim();
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers) ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova più tardi." },
      { status: 429, headers: corsHeaders(request) },
    );
  }

  // Auth check: webhook secret must be configured and provided
  const stored = await getSetting("webhook_secret");
  if (!stored) {
    return NextResponse.json(
      { error: "Webhook non configurato: impostare webhook_secret" },
      { status: 503, headers: corsHeaders(request) },
    );
  }

  const secretHeader = request.headers.get("x-webhook-secret");
  if (!secretHeader || secretHeader !== stored) {
    return NextResponse.json(
      { error: "Secret non valido o mancante" },
      { status: 401, headers: corsHeaders(request) },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalido" },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  const payload = parsed.data;
  const fields = extractFields(payload);

  if (!fields.name && !fields.email && !fields.phone) {
    return NextResponse.json(
      {
        error: "Inserisci almeno nome, email o telefono",
        received: Object.keys(payload),
        hint: "Campi supportati: name, nombre, full_name, email, correo, phone, telefono, company, empresa, notes, notas, message",
      },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  try {
    const { lead, duplicate } = await ingestLead(
      {
        name: fields.name || null,
        email: fields.email || null,
        phone: fields.phone || null,
        company: fields.company || null,
        message: fields.notes || null,
        source: "webhook",
        rawData: payload,
      },
      {
        ip,
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
      },
    );

    await triggerWorkflows(
      "webhook",
      {
        leadId: lead.id,
        contactId: lead.contactId,
        source: "webhook",
        rawPayload: payload,
      },
      `webhook:${lead.id}`,
    );

    return NextResponse.json(
      {
        success: true,
        leadId: lead.id,
        duplicate,
      },
      { status: 201, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("[webhook] Errore nell'ingestion del lead:", error);
    return NextResponse.json(
      { error: "Errore interno nella creazione del lead" },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: corsHeaders(request),
  });
}
