import type { FunnelCondition, FunnelStep } from "@/lib/capture/types";

let stepCounter = 0;

export function parseFunnelSteps(raw: string): FunnelStep[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FunnelStep[]) : [];
  } catch {
    return [];
  }
}

export function newFunnelStep(landingPageId = ""): FunnelStep {
  stepCounter += 1;
  return {
    id: `step_${Date.now().toString(36)}_${stepCounter}`,
    name: `Step ${stepCounter}`,
    landingPageId,
    nextStepId: null,
    conditions: [],
  };
}

function conditionMatches(
  condition: FunnelCondition,
  values: Record<string, unknown>,
): boolean {
  const raw = values[condition.field];
  if (condition.operator === "exists") {
    return raw !== undefined && raw !== null && String(raw).trim().length > 0;
  }
  return String(raw ?? "").trim() === String(condition.value ?? "").trim();
}

export function resolveNextStep(
  step: FunnelStep,
  values: Record<string, unknown>,
): string | null {
  for (const condition of step.conditions ?? []) {
    const next = conditionMatches(condition, values)
      ? condition.trueNextStepId
      : condition.falseNextStepId;
    if (next) return next;
  }
  return step.nextStepId ?? null;
}

export function isValidSessionId(value: string | null | undefined): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]{8,128}$/.test(value));
}
