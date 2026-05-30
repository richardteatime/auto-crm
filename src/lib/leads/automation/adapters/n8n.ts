// ---------------------------------------------------------------------------
// n8nEngine — AutomationEngine adapter for n8n (https://n8n.io).
//
// PLACEHOLDER / disabled by default. n8n is an external workflow runner; this
// adapter lets the CRM hand off automation triggers to it instead of running
// them in-process. It is OFF unless BOTH of these are set:
//   ENABLE_N8N_AUTOMATIONS=true
//   N8N_WEBHOOK_URL=https://<your-n8n>/webhook/<id>
// Optional: N8N_API_KEY (sent as the `x-n8n-api-key` header when present).
//
// Safety (PLAN): never block the lead flow. When n8n is off OR a dispatch
// fails, we transparently fall back to the internal engine. Nothing here ever
// throws, and the API key is never logged.
// ---------------------------------------------------------------------------

import type { AutomationTrigger } from "../../types";
import type { AutomationEngine, TriggerResult } from "../types";
import { runTrigger as runTriggerInternal } from "../engine";

const ENABLED = process.env.ENABLE_N8N_AUTOMATIONS === "true";
const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "";
const API_KEY = process.env.N8N_API_KEY || "";

// Don't hang lead processing on a slow/unreachable n8n instance.
const DISPATCH_TIMEOUT_MS = 10_000;

export function isN8nConfigured(): boolean {
  return ENABLED && !!WEBHOOK_URL;
}

// Result shape when a trigger is handed off to n8n: no in-process runs happen,
// so `runs` is empty and `matchedRules` is 0 — the audit trail lives in n8n.
function dispatchedResult(
  trigger: AutomationTrigger,
  leadId: string | null,
): TriggerResult {
  return { trigger, leadId, matchedRules: 0, runs: [] };
}

export const n8nEngine: AutomationEngine = {
  async runTrigger(trigger, payload): Promise<TriggerResult> {
    const leadId = typeof payload.leadId === "string" ? payload.leadId : null;

    // Disabled or unconfigured → internal engine handles it.
    if (!isN8nConfigured()) {
      if (ENABLED) {
        console.info(
          `[automation:n8n] enabled but N8N_WEBHOOK_URL is unset; using internal engine`,
        );
      }
      return runTriggerInternal(trigger, payload);
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (API_KEY) headers["x-n8n-api-key"] = API_KEY;

      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ trigger, payload }),
        signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        console.error(
          `[automation:n8n] dispatch failed (${res.status}); falling back to internal engine`,
        );
        return runTriggerInternal(trigger, payload);
      }

      console.info(`[automation:n8n] dispatched trigger "${trigger}" (lead ${leadId ?? "n/a"})`);
      return dispatchedResult(trigger, leadId);
    } catch (e) {
      console.error(
        "[automation:n8n] dispatch error; falling back to internal engine:",
        e instanceof Error ? e.message : e,
      );
      return runTriggerInternal(trigger, payload);
    }
  },
};
