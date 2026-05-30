import { getLead } from "@/lib/db/leads";
import {
  listAutomationRules,
  createAutomationRun,
  updateAutomationRun,
} from "@/lib/db";
import type {
  AutomationRule,
  AutomationRunStatus,
  AutomationTrigger,
  Lead,
} from "../types";
import { executeAction } from "./actions";
import type {
  ActionResult,
  AutomationContext,
  TriggerResult,
} from "./types";

// rule.actions is a JSON string ["actionName", ...] (or [{action}] objects).
function parseActions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr
        .map((a) =>
          typeof a === "string"
            ? a
            : a && typeof (a as { action?: unknown }).action === "string"
              ? (a as { action: string }).action
              : null,
        )
        .filter((a): a is string => !!a);
    }
  } catch {
    // fall through
  }
  return [];
}

function overallStatus(results: ActionResult[]): AutomationRunStatus {
  if (results.length === 0) return "completed";
  const failed = results.filter((r) => r.status === "failed").length;
  if (failed === 0) return "completed";
  if (failed === results.length) return "failed";
  return "partial";
}

function resultsToLines(results: ActionResult[]): string[] {
  return results.map(
    (r) => `${r.action}:${r.status}${r.detail ? `(${r.detail})` : ""}`,
  );
}

// Scope filter: a rule applies if its stage/category constraints (when set)
// match the lead. Null constraints mean "any".
function ruleMatchesLead(rule: AutomationRule, lead: Lead): boolean {
  if (rule.pipelineStage && rule.pipelineStage !== lead.pipelineStage) return false;
  if (rule.leadCategory && rule.leadCategory !== lead.category) return false;
  return true;
}

// ---------------------------------------------------------------------------
// runTrigger — the internal AutomationEngine entry point.
// NEVER throws: any failure is logged and reflected in the returned result /
// the automation_runs records. Every invocation that has a real lead logs at
// least one automation_run (audit requirement from PLAN).
// ---------------------------------------------------------------------------
export async function runTrigger(
  trigger: AutomationTrigger,
  payload: Record<string, unknown>,
): Promise<TriggerResult> {
  const leadId = typeof payload.leadId === "string" ? payload.leadId : null;
  const result: TriggerResult = { trigger, leadId, matchedRules: 0, runs: [] };

  if (!leadId) {
    console.warn(`[automation] ${trigger}: no leadId in payload; nothing to run`);
    return result;
  }

  try {
    const lead = await getLead(leadId);
    if (!lead) {
      console.warn(`[automation] ${trigger}: lead ${leadId} not found`);
      return result;
    }

    const allRules = await listAutomationRules({
      triggerType: trigger,
      enabledOnly: true,
    });
    const rules = allRules.filter((r) => ruleMatchesLead(r, lead));
    result.matchedRules = rules.length;

    // No rule configured for this trigger → still log a run for the audit trail.
    if (rules.length === 0) {
      const run = await createAutomationRun({
        ruleId: null,
        leadId,
        triggerType: trigger,
        status: "completed",
      });
      if (run) {
        await updateAutomationRun(run.id, {
          status: "completed",
          actionsExecuted: ["(no matching rule)"],
        });
      }
      result.runs.push({
        runId: run?.id ?? null,
        ruleId: null,
        status: "completed",
        actions: [],
      });
      return result;
    }

    for (const rule of rules) {
      const run = await createAutomationRun({
        ruleId: rule.id,
        leadId,
        triggerType: trigger,
        status: "running",
      });

      const ctx: AutomationContext = { trigger, lead, rule, payload };
      const actionResults: ActionResult[] = [];
      for (const name of parseActions(rule.actions)) {
        actionResults.push(await executeAction(name, ctx));
      }

      const status = overallStatus(actionResults);
      const errorLines = actionResults
        .filter((r) => r.status === "failed")
        .map((r) => `${r.action}: ${r.detail ?? ""}`);

      if (run) {
        await updateAutomationRun(run.id, {
          status,
          actionsExecuted: resultsToLines(actionResults),
          error: errorLines.length ? errorLines.join("; ") : null,
        });
      }

      result.runs.push({
        runId: run?.id ?? null,
        ruleId: rule.id,
        status,
        actions: actionResults,
      });
    }

    return result;
  } catch (e) {
    console.error(
      `[automation] ${trigger} failed:`,
      e instanceof Error ? e.message : e,
    );
    return result;
  }
}
