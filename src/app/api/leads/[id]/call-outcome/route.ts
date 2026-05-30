import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getLead,
  getOpenCallTaskForLead,
  createCallTask,
  updateCallTask,
} from "@/lib/db";
import { fireTrigger, leoIdentity } from "@/lib/leads/automation";
import { CALL_OUTCOMES, type CallOutcome } from "@/lib/leads/types";

// POST /api/leads/[id]/call-outcome  { outcome, notes? }
// Leo records the result of a call. Persists the outcome on the call task and
// fires `call_completed`; the post-call routing (move to proposal / lost /
// follow-up) lives in that automation (Day 6 route_lead_by_outcome).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: { outcome?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const outcome = body.outcome;
  if (!outcome || !CALL_OUTCOMES.includes(outcome as CallOutcome)) {
    return NextResponse.json(
      { error: "Esito chiamata non valido", validOutcomes: CALL_OUTCOMES },
      { status: 400 },
    );
  }
  const notes = body.notes ?? null;

  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  }

  try {
    // Upsert the call task → completed with the recorded outcome.
    let task = await getOpenCallTaskForLead(id);
    if (!task) {
      task = await createCallTask({
        leadId: id,
        assignedTo: leoIdentity.id,
        assigneeName: leoIdentity.name,
        status: "pending",
        notes,
      });
    }
    const completed = await updateCallTask(task.id, {
      status: "completed",
      callOutcome: outcome as CallOutcome,
      notes,
      completedAt: new Date(),
    });

    // Fire post-call automation. Routing by outcome happens inside (Day 6).
    const automation = await fireTrigger("call_completed", {
      leadId: id,
      outcome,
      notes,
      callTaskId: completed.id,
    });

    // Reload to reflect any stage/status changes made by the routing.
    const updatedLead = await getLead(id);

    return NextResponse.json({
      success: true,
      leadId: id,
      outcome,
      callTaskId: completed.id,
      pipelineStage: updatedLead?.pipelineStage ?? lead.pipelineStage,
      status: updatedLead?.status ?? lead.status,
      automation: {
        matchedRules: automation.matchedRules,
        runs: automation.runs.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Errore nel salvataggio dell'esito: ${
          error instanceof Error ? error.message : "sconosciuto"
        }`,
      },
      { status: 500 },
    );
  }
}
