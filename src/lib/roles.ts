// Roles come from Appwrite user labels. No label = full access (founders);
// label "commerciale" = salesperson, who only sees the Lead section.
// Shared by the proxy (server) and the UI (client): keep it free of server imports.

export const SALES_LABEL = "commerciale";

export type Role = "admin" | "commerciale";

export function roleFromLabels(labels: readonly string[] | null | undefined): Role {
  return labels?.includes(SALES_LABEL) ? "commerciale" : "admin";
}

/** Everything a salesperson may open: the Lead section, own settings (password, notifications), auth */
const SALES_ALLOWED = ["/leads", "/settings", "/api/leads", "/api/push", "/api/auth", "/api/health"];

export function salesCanAccess(pathname: string): boolean {
  return SALES_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Where a salesperson lands */
export const SALES_HOME = "/leads";
