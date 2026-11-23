import { NextRequest, NextResponse } from "next/server";
import { normalizeIntakePayload } from "@/lib/leads/intake";
import { ingestLead } from "@/lib/leads/service";
import { isLeadLine } from "@/lib/leads/types";

// Public intake for OUR landing pages (browser → CRM, no secret in the page).
// Guards: allowed origins (env LANDING_ORIGINS, comma list; "*.netlify.app" style wildcards ok),
// honeypot field "website", per-IP rate limit, explicit line "sito" | "ecommerce", phone required.

const hits = new Map<string, number[]>();
const WINDOW = 10 * 60_000;
const MAX_PER_WINDOW = 6;

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const list = (process.env.LANDING_ORIGINS || "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  for (const a of list) {
    if (a === origin) return origin;
    if (a.includes("*")) {
      // "https://*.netlify.app": one wildcard = one DNS label
      const [head, tail] = a.toLowerCase().split("*", 2);
      const o = origin.toLowerCase();
      const mid = o.slice(head.length, o.length - tail.length);
      if (o.startsWith(head) && o.endsWith(tail) && /^[a-z0-9-]+$/.test(mid)) return origin;
    }
  }
  return null;
}

function cors(origin: string | null) {
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

export function OPTIONS(request: NextRequest) {
  const origin = allowedOrigin(request.headers.get("origin"));
  return new NextResponse(null, { status: origin ? 204 : 403, headers: cors(origin) });
}

export async function POST(request: NextRequest) {
  const origin = allowedOrigin(request.headers.get("origin"));
  const headers = cors(origin);
  if (!origin) return NextResponse.json({ ok: false, error: "origin_not_allowed" }, { status: 403, headers });

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= MAX_PER_WINDOW) return NextResponse.json({ ok: false, error: "too_many" }, { status: 429, headers });
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 20_000) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413, headers });
    body = JSON.parse(raw) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers });
  }

  // Bots fill every field: a filled honeypot gets a fake success and is dropped
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true }, { status: 201, headers });
  delete body.website;
  if (!isLeadLine(body.line)) return NextResponse.json({ ok: false, error: "invalid_line" }, { status: 422, headers });
  // Consent is part of the form: without it we don't store the person
  if (body.privacy !== true && body.privacy !== "true" && body.privacy !== "on") {
    return NextResponse.json({ ok: false, error: "missing_consent" }, { status: 422, headers });
  }

  const n = normalizeIntakePayload(body);
  if (!n.phone) return NextResponse.json({ ok: false, error: "missing_phone", hint: "Serve il numero di telefono" }, { status: 422, headers });
  if (!n.context.form) n.context.form = typeof body.landing === "string" ? body.landing.slice(0, 120) : `Landing ${body.line}`;

  try {
    const { lead, duplicate } = await ingestLead(n, "landing");
    return NextResponse.json({ ok: true, id: lead.id, duplicate }, { status: duplicate ? 200 : 201, headers });
  } catch (e) {
    console.error("[landing intake]", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers });
  }
}
