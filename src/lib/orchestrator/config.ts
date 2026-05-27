// ---------------------------------------------------------------------------
// Feature flags & orchestrator configuration
// ---------------------------------------------------------------------------

export const ORCHESTRATOR_CONFIG = {
  enableInternalCommands: getBoolEnv("ENABLE_INTERNAL_COMMANDS", true),
  enableGitAgentDispatch: getBoolEnv("ENABLE_GITAGENT_DISPATCH", false),
  enableAutoDeployPreview: getBoolEnv("ENABLE_AUTODEPLOY_PREVIEW", false),
  enableCustomerAutomation: getBoolEnv("ENABLE_CUSTOMER_AUTOMATION", false),
  customerAutomationUnlocked: getBoolEnv("CUSTOMER_AUTOMATION_UNLOCKED", false),
} as const;

function getBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === "true" || value === "1";
}

export function getAdminWhatsAppNumbers(): string[] {
  const raw = process.env.ADMIN_WHATSAPP_NUMBERS || "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

export function getAdminTelegramIds(): string[] {
  const raw = process.env.ADMIN_TELEGRAM_IDS || "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}
