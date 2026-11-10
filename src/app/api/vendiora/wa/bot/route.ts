import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLead, leadInScope } from "@/lib/db/leads";
import { startBotForLead, setBotState } from "@/lib/vendiora/bot";
import { readBody } from "@/lib/vendiora/http";

// { leadId, action: "start" | "stop" }: restart the bot by hand or stop it for one lead
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const body = await readBody(request);
  if (body instanceof NextResponse) return body;
  const lead = typeof body.leadId === "string" ? await getLead(body.leadId) : null;
  if (!lead || !leadInScope(lead)) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  try {
    if (body.action === "stop") {
      await setBotState(lead.id, "fermo");
      return NextResponse.json({ ok: true });
    }
    const r = await startBotForLead(lead, { force: true });
    if (!r.started) return NextResponse.json({ error: `Bot non avviato: ${r.reason}` }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Errore" }, { status: 502 });
  }
}
