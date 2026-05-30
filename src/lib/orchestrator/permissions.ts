import type { SenderRole } from "./types";
import {
  getAdminWhatsAppNumbers,
  getAdminTelegramIds,
  ORCHESTRATOR_CONFIG,
} from "./config";

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
