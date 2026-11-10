import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLead, leadInScope } from "@/lib/db/leads";
import { sendFromCrm } from "@/lib/vendiora/bot";
import { WaSendError } from "@/lib/vendiora/wa";
import { readBody, str } from "@/lib/vendiora/http";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const body = await readBody(request);
  if (body instanceof NextResponse) return body;
  const text = str(body.text, 4000);
  const lead = typeof body.leadId === "string" ? await getLead(body.leadId) : null;
  if (!lead || !leadInScope(lead)) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  if (!text) return NextResponse.json({ error: "Scrivi un messaggio" }, { status: 400 });
  try {
    await sendFromCrm(lead, text, auth.user.name || auth.user.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = e instanceof WaSendError ? (e.code >= 400 && e.code < 600 ? e.code : 502) : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invio fallito" }, { status: code === 401 ? 502 : code });
  }
}
