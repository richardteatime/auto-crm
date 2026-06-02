import type { AutomationTrigger } from "../types";
import { runTrigger } from "./engine";
import type { AutomationEngine, TriggerResult } from "./types";
import { n8nEngine, isN8nConfigured } from "./adapters/n8n";

export const internalEngine: AutomationEngine = { runTrigger };

// Single entry point for the rest of the app. n8n is predisposed but disabled
// by default; it only takes over when ENABLE_N8N_AUTOMATIONS=true AND
// N8N_WEBHOOK_URL is set. Otherwise the internal engine runs everything.
export function getAutomationEngine(): AutomationEngine {
  return isN8nConfigured() ? n8nEngine : internalEngine;
}

// Convenience: fire a trigger through the active engine. Never throws.
export function fireTrigger(
  trigger: AutomationTrigger,
  payload: Record<string, unknown>,
): Promise<TriggerResult> {
  return getAutomationEngine().runTrigger(trigger, payload);
}

export { runTrigger } from "./engine";
export {
  registerAction,
  hasAction,
  executeAction,
  leadSummaryHtml,
  leoIdentity,
  setterIdentity,
} from "./actions";
export {
  isEmailConfigured,
  sendEmail,
  sendToLeo,
  sendToSetter,
  sendToFounder,
  sendToInternalTeam,
} from "./adapters/email";
export {
  isMessagingConfigured,
  sendWhatsAppMessage,
  sendInternalMessage,
} from "./adapters/messaging";
export { n8nEngine, isN8nConfigured } from "./adapters/n8n";
export type {
  AutomationContext,
  ActionResult,
  ActionHandler,
  ActionStatus,
  AutomationRunResult,
  TriggerResult,
  AutomationEngine,
} from "./types";
