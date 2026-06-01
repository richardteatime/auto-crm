import { NextRequest, NextResponse } from "next/server";
import { ingestLead } from "@/lib/capture/ingest";
import { clientIp } from "@/lib/capture/analytics";

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON invalido" }, { status: 400 });
  }

  const str = (k: string): string | null => {
    const v = body[k];
    return typeof v === "string" && v.trim().length ? v.trim() : null;
  };

  const name = str("name");
  const email = str("email");
  const phone = str("phone");

  // Need at least one way to identify the lead.
  if (!name && !email && !phone) {
    return NextResponse.json(
      { success: false, error: "Inserisci almeno nome, email o telefono." },
      { status: 400 },
    );
  }

  const rawData =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : null;

  try {
    const { lead, duplicate } = await ingestLead(
      {
        name,
        firstName: str("firstName"),
        lastName: str("lastName"),
        email,
        phone,
        company: str("company"),
        website: str("website"),
        message: str("message"),
        budget: str("budget"),
        source: str("source"),
        landingPageId: str("landingPageId"),
        formId: str("formId"),
        funnelId: str("funnelId"),
        bookingLinkId: str("bookingLinkId"),
        rawData,
      },
      {
        ip,
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
        sessionId: str("sessionId"),
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
