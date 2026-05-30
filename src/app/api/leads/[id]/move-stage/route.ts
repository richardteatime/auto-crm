import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { moveLeadStage, isValidStage } from "@/lib/leads/pipeline";
import { LEAD_PIPELINE_STAGES } from "@/lib/leads/types";

// POST /api/leads/[id]/move-stage  { toStage, reason? }
// Manual pipeline movement from the CRM UI. Session-authenticated.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: { toStage?: string; stage?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const toStage = body.toStage ?? body.stage;
  if (!toStage || !isValidStage(toStage)) {
    return NextResponse.json(
      {
        error: "Fase non valida",
        validStages: LEAD_PIPELINE_STAGES,
      },
      { status: 400 },
    );
  }

  try {
    const result = await moveLeadStage({
      leadId: id,
      toStage,
      reason: body.reason ?? null,
      triggeredBy: "user",
      metadata: { actor: auth.user?.email ?? "user" },
    });

    if (!result.ok) {
      if (result.error === "not_found") {
        return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
      }
      return NextResponse.json({ error: "Fase non valida" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      leadId: id,
      changed: result.changed,
      fromStage: result.fromStage,
      pipelineStage: result.lead?.pipelineStage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Errore nello spostamento di fase: ${
          error instanceof Error ? error.message : "sconosciuto"
        }`,
      },
      { status: 500 },
    );
  }
}
