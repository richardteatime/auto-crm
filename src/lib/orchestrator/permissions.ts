import type { SenderRole } from "./types";
import {
  getAdminWhatsAppNumbers,
  getAdminTelegramIds,
  ORCHESTRATOR_CONFIG,
} from "./config";
import type { CrmOperator } from "@/lib/crm-operators/types";
import {
  hasOperatorScope,
  mapOperatorRoleToSenderRole,
} from "@/lib/crm-operators/types";

/**
 * Normalize a phone number for comparison.
 * Removes spaces, dashes, parentheses. Keeps the leading + if present.
 */
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/[\s\-\(\)]/g, "").toLowerCase();
}

/**
 * Determine the sender role based on phone number or Telegram ID.
 */
export function resolveSenderRole(
  phone: string | null | undefined,
  telegramId: string | null | undefined,
): SenderRole {
  if (phone) {
    const normalized = normalizePhone(phone);
    const admins = getAdminWhatsAppNumbers().map(normalizePhone);
    if (admins.includes(normalized)) {
      return "founder_admin";
    }
  }

  if (telegramId) {
    const admins = getAdminTelegramIds();
    if (admins.includes(telegramId)) {
      return "founder_admin";
    }
  }

  return "customer";
}

/**
 * Check if a sender role is allowed to execute internal commands (Step 1).
 */
export function isInternalCommandAllowed(role: SenderRole): boolean {
  return role === "founder_admin";
}

/**
 * Check if customer automation is active (Step 2).
 * Must be both enabled AND unlocked.
 */
export function isCustomerAutomationActive(): boolean {
  const { enableCustomerAutomation, customerAutomationUnlocked } = ORCHESTRATOR_CONFIG;
  return enableCustomerAutomation && customerAutomationUnlocked;
}

/**
 * Universal permission check for incoming messages.
 *
 * Returns:
 * - allowed: true + role  → proceed
 * - allowed: false + role → block and reply
 */
export function checkMessagePermission(
  phone: string | null | undefined,
  telegramId?: string | null | undefined,
): {
  allowed: boolean;
  role: SenderRole;
  reason: string | null;
} {
  const role = resolveSenderRole(phone, telegramId);

  // Step 1: internal commands only for founder_admin
  if (isInternalCommandAllowed(role)) {
    return { allowed: true, role, reason: null };
  }

  // Step 2: customer automation — always blocked for now
  if (isCustomerAutomationActive() && role === "customer") {
    return { allowed: true, role, reason: null };
  }

  return {
    allowed: false,
    role,
    reason: "Questo canale al momento è riservato ai comandi interni SarconX.",
  };
}

export interface OperatorMessagePermission {
  allowed: boolean;
  role: SenderRole;
  reason: string | null;
  operator: CrmOperator | null;
}

async function resolveOperator(
  telegramId: string | null | undefined,
  chatwootContactId: string | number | null | undefined,
): Promise<CrmOperator | null> {
  try {
    const operators = await import("@/lib/db/crm-operators");
    return (
      (await operators.getOperatorByTelegramUserId(telegramId)) ??
      (await operators.getOperatorByChatwootContactId(chatwootContactId))
    );
  } catch (error) {
    console.warn(
      "[orchestrator/permissions] operator lookup skipped:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Permission check for internal CRM command channels.
 *
 * First resolves an active CRM operator from persistent operator profiles.
 * If no operator profile exists yet, it falls back to the legacy env allow-list
 * so existing founder/admin access keeps working during migration.
 */
export async function checkInternalCommandPermission(params: {
  phone: string | null | undefined;
  telegramId?: string | null | undefined;
  chatwootContactId?: string | number | null | undefined;
  requiredScope?: string;
}): Promise<OperatorMessagePermission> {
  const requiredScope = params.requiredScope ?? "crm:command";
  const operator = await resolveOperator(params.telegramId, params.chatwootContactId);

  if (operator) {
    const role = mapOperatorRoleToSenderRole(operator.role);
    if (hasOperatorScope(operator, requiredScope)) {
      return { allowed: true, role, reason: null, operator };
    }

    return {
      allowed: false,
      role,
      operator,
      reason: "Operatore riconosciuto, ma senza permesso per questo comando CRM.",
    };
  }

  const legacy = checkMessagePermission(params.phone, params.telegramId);
  return {
    ...legacy,
    operator: null,
  };
}
