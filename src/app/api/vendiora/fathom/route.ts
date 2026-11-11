import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHmac } from "crypto";
import { vendioraEnabled } from "@/lib/roles";
import { getSettings } from "@/lib/vendiora/db";
import { ingestFathom, parseFathom } from "@/lib/vendiora/engine";

// Fathom webhook ("new meeting content ready") or Zapier / Make forwarding the same fields.
// Auth: ?secret=<Impostazioni → Playbook → Fathom secret> or header x-vendiora-secret, or Fathom's
// webhook-signature (HMAC-SHA256 of id.timestamp.body with the same secret, base64).
// Call titles must contain the code (e.g. "BASE-C3 – Mario Rossi"); "SALES-CALL" for the sales call.

export const dynamic = "force-dynamic";

const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: NextRequest) {
  if (!vendioraEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const s = await getSettings();
  const secret = s.playbook.fathomSecret;
  if (!secret || secret.length < 16) return NextResponse.json({ error: "Webhook Fathom non configurato" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 2_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  const given = request.nextUrl.searchParams.get("secret") || request.headers.get("x-vendiora-secret") || "";
  let ok = !!given && eq(given, secret);
  const sig = request.headers.get("webhook-signature");
  if (!ok && sig) {
    const id = request.headers.get("webhook-id") ?? "";
    const ts = request.headers.get("webhook-timestamp") ?? "";
    const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret);
    const exp = createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64");
    ok = sig.split(" ").some((p) => eq(p.replace(/^v1,/, ""), exp));
  }
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON non valido" }, { status: 400 }); }
  try {
    const r = await ingestFathom(parseFathom(body));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[fathom]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "errore" }, { status: 500 });
  }
}
