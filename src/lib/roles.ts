// Roles come from Appwrite user labels. No label = full access (founders);
// label "commerciale" = salesperson, who only sees the Lead section.
// Shared by the proxy (server) and the UI (client): keep it free of server imports.

export const SALES_LABEL = "commerciale";

export type Role = "admin" | "commerciale";

export function roleFromLabels(labels: readonly string[] | null | undefined): Role {
  // Separate CRM instance (server only): whoever is let in has full access there
  if (typeof process !== "undefined" && process.env.CRM_ACCESS_LABEL) return "admin";
  return labels?.includes(SALES_LABEL) ? "commerciale" : "admin";
}

/**
 * Separate CRM instance (CRM_ACCESS_LABEL set, server only): only users carrying
 * that Appwrite label may enter. The SarconX CRM lets every account in.
 */
export function canEnterCrm(labels: readonly string[] | null | undefined): boolean {
  const access = typeof process !== "undefined" ? (process.env.CRM_ACCESS_LABEL || "").trim() : "";
  return !access || !!labels?.includes(access);
}

/**
 * Accounts shut out of this CRM (comma list of Appwrite user ids in CRM_BLOCKED_USERS).
 * Used to keep someone who has their own CRM instance out of the SarconX one.
 */
export function isBlockedUser(userId: string | null | undefined): boolean {
  if (!userId || typeof process === "undefined") return false;
  return (process.env.CRM_BLOCKED_USERS || "").split(",").map((s) => s.trim()).filter(Boolean).includes(userId);
}

/**
 * Vendiora (the sub-CRM for the infobusiness) runs only in the SarconX CRM, never in a
 * separate instance; VENDIORA_ENABLED=0 switches it off. Server only.
 */
export function vendioraEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if ((process.env.CRM_ACCESS_LABEL || "").trim()) return false;
  return process.env.VENDIORA_ENABLED !== "0";
}

/** Everything a salesperson may open: the Lead section, own settings (password, notifications), auth */
const SALES_ALLOWED = [
  "/leads", "/settings", "/api/leads", "/api/push", "/api/auth", "/api/health",
];
// Vendiora is founders-only: salespeople never reach it

export function salesCanAccess(pathname: string): boolean {
  return SALES_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Where a salesperson lands */
export const SALES_HOME = "/leads";
