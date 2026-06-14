import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createContact } from "@/lib/db/contacts";
import { createActivity } from "@/lib/db/activities";
import { getSetting } from "@/lib/db/settings";
import { triggerWorkflows } from "@/lib/workflows/trigger";

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
  payload: Record<string, unknown>
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
  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova più tardi." },
      { status: 429 }
    );
  }

  // Auth check: webhook secret must be configured and provided
  const stored = await getSetting("webhook_secret");
  if (!stored) {
    return NextResponse.json(
      { error: "Webhook non configurato: impostare webhook_secret" },
      { status: 503 }
    );
  }

  const secretHeader = request.headers.get("x-webhook-secret");
  if (!secretHeader || secretHeader !== stored) {
    return NextResponse.json(
      { error: "Secret non valido o mancante" },
      { status: 401 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const fields = extractFields(payload);

  if (!fields.name) {
    return NextResponse.json(
      {
        error: "Il campo 'name' o 'nombre' è obbligatorio",
        received: Object.keys(payload),
        hint: "Campi supportati: name, nombre, full_name, email, correo, phone, telefono, company, empresa, notes, notas, message",
      },
      { status: 400 }
    );
  }

  try {
    const contact = await createContact({
      name: fields.name,
      email: fields.email || null,
      phone: fields.phone || null,
      company: fields.company || null,
      source: "webhook",
      temperature: "cold",
      notes: fields.notes || null,
    });

    // Log activity for the new lead
    await createActivity({
      type: "note",
      description: `Lead ricevuto via webhook${fields.company ? ` (${fields.company})` : ""}`,
      contactId: contact.id,
    });

    await triggerWorkflows(
      "webhook",
      {
        contactId: contact.id,
        name: contact.name,
        email: contact.email,
        source: "webhook",
        rawPayload: payload,
      },
      `webhook:${contact.id}`,
    );

    await triggerWorkflows(
      "contact_created",
      {
        contactId: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        source: contact.source,
      },
      `contact_created:${contact.id}`,
    );

    return NextResponse.json(
      {
        success: true,
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          source: contact.source,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[webhook] Errore nella creazione del contatto:", error);
    return NextResponse.json(
      { error: "Errore interno nella creazione del contatto" },
      { status: 500 }
    );
  }
}
