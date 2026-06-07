import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import {
  getLead,
  getOpenCallTaskForLead,
  createCallTask,
  updateCallTask,
} from "@/lib/db";
import { leoIdentity } from "@/lib/leads/automation";
import { CALL_OUTCOMES, OUTCOME_LABELS, type CallOutcome } from "@/lib/leads/types";
import { triggerWorkflows } from "@/lib/workflows/trigger";

const BodySchema = z.object({
  outcome: z.enum(CALL_OUTCOMES as [string, ...string[]]),
  notes: z.string().optional().nullable(),
});

// POST /api/leads/[id]/call-outcome  { outcome, notes? }
// Records the call outcome on the open task and then hands off post-call
// routing to the visual Workflow Builder (trigger: call_outcome_recorded).
// The legacy code-engine routing has been disabled to avoid duplicate actions.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const outcome = parsed.data.outcome;
  const notes = parsed.data.notes ?? null;

  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  }

  try {
    // Upsert the call task → completed with the recorded outcome.
    // Prefer the task assigned to the authenticated user to avoid closing the
    // wrong task when both setter and closer have open tasks.
    let task = await getOpenCallTaskForLead(id, auth.user.id);
    if (!task) {
      task = await getOpenCallTaskForLead(id);
    }
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

    // Reload to reflect any stage/status changes made by the workflow builder.
    const updatedLead = await getLead(id);

    // Hand off post-call routing to the visual Workflow Builder.
    await triggerWorkflows(
      "call_outcome_recorded",
      {
        leadId: id,
        outcome,
        outcomeLabel: OUTCOME_LABELS[outcome as CallOutcome] ?? outcome,
        assignedTo: completed.assignedTo,
        assigneeName: completed.assigneeName,
        callTaskId: completed.id,
        name: updatedLead?.fullName ?? lead.fullName,
        email: updatedLead?.email ?? lead.email,
        phone: updatedLead?.phone ?? lead.phone,
      },
      `call_outcome_recorded:${id}:${outcome}`,
    );

    return NextResponse.json({
      success: true,
      leadId: id,
      outcome,
      callTaskId: completed.id,
      pipelineStage: updatedLead?.pipelineStage ?? lead.pipelineStage,
      status: updatedLead?.status ?? lead.status,
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
