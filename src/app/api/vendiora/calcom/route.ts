import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { vendioraEnabled } from "@/lib/roles";
import { getSettings } from "@/lib/vendiora/db";
import { ingestCal, parseCal } from "@/lib/vendiora/calcom";

// Cal.com webhook (cloud or self-hosted). Auth: X-Cal-Signature-256 = hex HMAC-SHA256 of the raw body
// with the secret set in Impostazioni → Playbook → Cal.com (same secret in Cal.com's webhook form).

export const dynamic = "force-dynamic";

const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: NextRequest) {
  if (!vendioraEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const s = await getSettings();
  const secret = s.playbook.cal.secret;
  if (!secret || secret.length < 16) return NextResponse.json({ error: "Webhook Cal.com non configurato" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  const sig = (request.headers.get("x-cal-signature-256") ?? "").trim().toLowerCase();
  const exp = createHmac("sha256", secret).update(raw).digest("hex");
  if (!sig || !eq(sig, exp)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON non valido" }, { status: 400 }); }
  try {
    const e = parseCal(body);
    const r = await ingestCal(e);
    console.log(`[calcom] ${e.trigger} ${e.uid ?? ""} → ${r.matched}`);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[calcom]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "errore" }, { status: 500 });
  }
}
