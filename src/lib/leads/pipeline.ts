import { getLead, updateLead, createPipelineMovement } from "@/lib/db";
import { fireTrigger } from "./automation";
import {
  LEAD_PIPELINE_STAGES,
  type AutomationTrigger,
  type Lead,
  type LeadPipelineStage,
} from "./types";

// ---------------------------------------------------------------------------
// Pipeline movement service — the single place a lead changes stage.
// Validates the target stage, persists it, and tracks the movement.
// Reused by the move-stage API and (Day 4+) by automations.
// Idempotent: moving to the current stage is a no-op (changed: false).
// ---------------------------------------------------------------------------

export function isValidStage(value: string): value is LeadPipelineStage {
  return (LEAD_PIPELINE_STAGES as string[]).includes(value);
}

export interface MoveStageParams {
  leadId: string;
  toStage: LeadPipelineStage;
  reason?: string | null;
  triggeredBy?: string; // "user" | "system" | "automation" | userId
  metadata?: Record<string, unknown> | null;
}

export interface MoveStageResult {
  ok: boolean;
  lead: Lead | null;
  changed: boolean;
  fromStage: LeadPipelineStage | null;
  error?: "not_found" | "invalid_stage";
}

export async function moveLeadStage(
  params: MoveStageParams,
): Promise<MoveStageResult> {
  const { leadId, toStage } = params;

  if (!isValidStage(toStage)) {
    return { ok: false, lead: null, changed: false, fromStage: null, error: "invalid_stage" };
  }

  const lead = await getLead(leadId);
  if (!lead) {
    return { ok: false, lead: null, changed: false, fromStage: null, error: "not_found" };
  }

  const fromStage = lead.pipelineStage;

  // Idempotent no-op — still a valid result, just nothing to track.
  if (fromStage === toStage) {
    return { ok: true, lead, changed: false, fromStage };
  }

  const updated = await updateLead(leadId, { pipelineStage: toStage });

  // Every pipeline movement is tracked (graceful: never blocks the move).
  await createPipelineMovement({
    leadId,
    fromStage,
    toStage,
    reason: params.reason ?? null,
    triggeredBy: params.triggeredBy ?? "user",
    metadata: params.metadata ?? null,
  });

  // Fire the stage automation (notify, and on proposal the quote draft).
  // Never throws — the move is already persisted and tracked above.
  const triggerName: AutomationTrigger = `stage_changed_to_${toStage}`;
  await fireTrigger(triggerName, { leadId, fromStage });

  return { ok: true, lead: updated, changed: true, fromStage };
}
