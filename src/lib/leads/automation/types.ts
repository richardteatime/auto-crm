import type {
  AutomationRule,
  AutomationRunStatus,
  AutomationTrigger,
  Lead,
} from "../types";

export interface AutomationContext {
  trigger: AutomationTrigger;
  lead: Lead;
  rule: AutomationRule | null;
  payload: Record<string, unknown>;
}

export type ActionStatus = "ok" | "skipped" | "failed";

export interface ActionResult {
  action: string;
  status: ActionStatus;
  detail?: string;
}

export type ActionHandler = (ctx: AutomationContext) => Promise<ActionResult>;

export interface AutomationRunResult {
  runId: string | null;
  ruleId: string | null;
  status: AutomationRunStatus;
  actions: ActionResult[];
}

export interface TriggerResult {
  trigger: AutomationTrigger;
  leadId: string | null;
  matchedRules: number;
  runs: AutomationRunResult[];
}

// PLAN abstraction: AutomationEngine.runTrigger(triggerName, payload).
// Implementations: internal (MVP, active), n8n (Day 9, disabled), webhook.
// Lives here (not in index.ts) so adapters can import the type without a
// runtime circular dependency on the barrel.
export interface AutomationEngine {
  runTrigger(
    trigger: AutomationTrigger,
    payload: Record<string, unknown>,
  ): Promise<TriggerResult>;
}

// Small helpers so handlers read cleanly.
export function ok(action: string, detail?: string): ActionResult {
  return { action, status: "ok", detail };
}
export function skip(action: string, detail?: string): ActionResult {
  return { action, status: "skipped", detail };
}
export function fail(action: string, detail?: string): ActionResult {
  return { action, status: "failed", detail };
}
