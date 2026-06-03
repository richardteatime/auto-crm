import type { SenderRole } from "@/lib/orchestrator/types";

export type CrmOperatorRole =
  | "admin"
  | "sales"
  | "finance"
  | "operations"
  | "developer";

export interface CrmOperator {
  id: string;
  name: string;
  appwriteUserId: string | null;
  telegramUserId: string | null;
  chatwootContactId: string | null;
  chatwootAgentId: string | null;
  role: CrmOperatorRole;
  scopes: string[];
  active: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function parseOperatorScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((scope) => String(scope).trim()).filter(Boolean);
  }

  if (typeof raw !== "string" || raw.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((scope) => String(scope).trim()).filter(Boolean);
    }
  } catch {
    // Fall back to comma-separated values below.
  }

  return raw
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function serializeOperatorScopes(scopes: string[]): string {
  return JSON.stringify(scopes.map((scope) => scope.trim()).filter(Boolean));
}

export function hasOperatorScope(
  operator: Pick<CrmOperator, "scopes" | "active"> | null,
  requiredScope: string,
): boolean {
  if (!operator?.active) return false;
  if (operator.scopes.includes("*") || operator.scopes.includes("crm:*")) return true;

  const [requiredDomain] = requiredScope.split(":");
  return operator.scopes.some((scope) => {
    if (scope === requiredScope) return true;
    if (!scope.endsWith(":*")) return false;
    return scope.slice(0, -2) === requiredDomain;
  });
}

export function mapOperatorRoleToSenderRole(role: CrmOperatorRole): SenderRole {
  switch (role) {
    case "admin":
      return "founder_admin";
    case "sales":
      return "sales";
    case "developer":
      return "developer";
    case "finance":
    case "operations":
      return "team_member";
  }
}
