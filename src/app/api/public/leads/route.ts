import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestLead } from "@/lib/capture/ingest";
import { clientIp } from "@/lib/capture/analytics";

const BodySchema = z.object({
  name: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  budget: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  landingPageId: z.string().optional().nullable(),
  formId: z.string().optional().nullable(),
  funnelId: z.string().optional().nullable(),
  bookingLinkId: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
  data: z.record(z.string(), z.unknown()).optional().nullable(),
});

// Public, unauthenticated conversion endpoint. Shared by landing pages, forms,
// funnels and bookings. Rate limited per IP to blunt spam.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
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

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers) ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: "Troppe richieste. Riprova più tardi." },
      { status: 429 },
    );
  }

  let rawBody;
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

  const data = parsed.data;

  // Need at least one way to identify the lead.
  if (!data.name && !data.email && !data.phone) {
    return NextResponse.json(
      { success: false, error: "Inserisci almeno nome, email o telefono." },
      { status: 400 },
    );
  }

  try {
    const { lead, duplicate } = await ingestLead(
      {
        name: data.name || null,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        website: data.website || null,
        message: data.message || null,
        budget: data.budget || null,
        source: data.source || null,
        landingPageId: data.landingPageId || null,
        formId: data.formId || null,
        funnelId: data.funnelId || null,
        bookingLinkId: data.bookingLinkId || null,
        rawData: data.data ?? null,
      },
      {
        ip,
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
        sessionId: data.sessionId || null,
      },
    );

    return NextResponse.json(
      { success: true, leadId: lead.id, duplicate },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Errore durante l'invio. Riprova." },
      { status: 500 },
    );
  }
}
