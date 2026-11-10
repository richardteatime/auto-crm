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

/** Everything a salesperson may open: the Lead section, own settings (password, notifications), auth */
const SALES_ALLOWED = [
  "/leads", "/settings", "/api/leads", "/api/push", "/api/auth", "/api/health",
  // Vendiora: salespeople see the dashboard and the WhatsApp chats (packages, clients, contracts stay founder-only)
  "/vendiora", "/vendiora/whatsapp", "/api/vendiora/wa", "/api/vendiora/chat", "/api/vendiora/inbox", "/api/vendiora/dashboard",
];
const SALES_EXACT = new Set(["/vendiora"]);

export function salesCanAccess(pathname: string): boolean {
  return SALES_ALLOWED.some((p) => pathname === p || (!SALES_EXACT.has(p) && pathname.startsWith(p + "/")));
}

/** Where a salesperson lands */
export const SALES_HOME = "/leads";
