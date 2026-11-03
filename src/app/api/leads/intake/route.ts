import { NextRequest, NextResponse } from "next/server";
import { checkIntakeSecret, normalizeIntakePayload } from "@/lib/leads/intake";
import { ingestLead } from "@/lib/leads/service";
import { LEAD_SOURCES } from "@/lib/leads/types";

// Public intake for Meta Instant Forms (via Make) and the sarconx.com landing (server-side).
// Auth: shared secret in "X-Lead-Secret" (or "Authorization: Bearer …", or ?key=).
// Idempotent on the Meta lead id: retries return 200 { duplicate: true }.

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const presented = request.headers.get("x-lead-secret") ?? bearer ?? url.searchParams.get("key");
  if (!checkIntakeSecret(presented)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  const type = request.headers.get("content-type") || "";
  try {
    if (type.includes("application/json")) body = await request.json();
    else if (type.includes("form")) body = Object.fromEntries((await request.formData()).entries());
    else body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const n = normalizeIntakePayload(body);
  if (!n.phone && !n.email) {
    return NextResponse.json({ ok: false, error: "missing_contact", hint: "Serve almeno telefono o email" }, { status: 422 });
  }

  const sourceParam = url.searchParams.get("source") || "meta_form";
  const source = (LEAD_SOURCES as readonly string[]).includes(sourceParam) ? sourceParam : "meta_form";

  try {
    const { lead, duplicate } = await ingestLead(n, source);
    return NextResponse.json({ ok: true, id: lead.id, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (e) {
    console.error("[lead intake]", e);
    // 5xx makes Make retry later; the lead id keeps the retry idempotent
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
