import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLead } from "@/lib/db/leads";
import { recordOutcome } from "@/lib/leads/service";
import { isCallOutcome, OUTCOME_CONFIG } from "@/lib/leads/types";

type Ctx = { params: Promise<{ id: string }> };

// POST { outcome, note?, nextActionAt?, lostReason?, value? (cents) }
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  if (!isCallOutcome(body.outcome)) return NextResponse.json({ error: "Esito non valido" }, { status: 400 });
  const cfg = OUTCOME_CONFIG[body.outcome];

  let nextActionAt: string | null = null;
  if (cfg.needsDate && body.nextActionAt) {
    if (typeof body.nextActionAt !== "string" || Number.isNaN(Date.parse(body.nextActionAt))) {
      return NextResponse.json({ error: "Data non valida" }, { status: 400 });
    }
    nextActionAt = new Date(body.nextActionAt).toISOString();
  }
  const value = typeof body.value === "number" && body.value >= 0 ? Math.round(body.value) : null;

  try {
    const updated = await recordOutcome(
      lead,
      {
        outcome: body.outcome,
        note: typeof body.note === "string" ? body.note : null,
        nextActionAt,
        lostReason: typeof body.lostReason === "string" ? body.lostReason : null,
        value,
      },
      { id: auth.user.id, name: auth.user.name }
    );
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Errore nel salvataggio dell'esito" }, { status: 500 });
  }
}
