import type { CrmOperator } from "./types";
import { hasOperatorScope } from "./types";
import type { RiskLevel, SenderRole } from "@/lib/orchestrator/types";

const READ_TOOLS = new Set([
  "getActiveProjects",
  "getLeadSummary",
  "getBlockedProjects",
  "getAgentStatus",
  "getDeploymentStatus",
  "getMyTasksToday",
  "searchContacts",
  "getContactDetails",
  "listDeals",
  "listProjects",
  "listTasks",
  "listActivities",
]);

const FINANCE_TOOLS = new Set(["getTodayRevenue"]);

const WRITE_TOOLS = new Set([
  "createProject",
  "createDeal",
  "createTask",
  "createContact",
  "updateContact",
  "updateDeal",
  "moveDeal",
  "updateProject",
  "updateTask",
  "addActivity",
]);

const LOW_RISK_MUTATION_TOOLS = new Set([
  "createTask",
  "createContact",
  "addActivity",
]);

const MEDIUM_RISK_MUTATION_TOOLS = new Set([
  "createProject",
  "createDeal",
  "updateContact",
  "updateDeal",
  "moveDeal",
  "updateProject",
  "updateTask",
]);

const DELETE_TOOLS = new Set([
  "deleteContact",
  "deleteDeal",
  "deleteProject",
  "deleteTask",
]);

const WORKFLOW_TOOLS = new Set([
  "startStaticSiteWorkflow",
  "generateAppForClient",
]);

function requiredScopeForTool(tool: string): string | null {
  if (tool === "reply" || tool === "done") return null;
  if (FINANCE_TOOLS.has(tool)) return "finance:read";
  if (DELETE_TOOLS.has(tool)) return "crm:delete";
  if (WORKFLOW_TOOLS.has(tool)) return "projects:workflow";
  if (WRITE_TOOLS.has(tool)) return "crm:write";
  if (READ_TOOLS.has(tool)) return "crm:read";
  return "crm:command";
}

export function getCrmToolRiskLevel(tool: string): RiskLevel {
  if (DELETE_TOOLS.has(tool)) return "critical";
  if (WORKFLOW_TOOLS.has(tool)) return "high";
  if (MEDIUM_RISK_MUTATION_TOOLS.has(tool)) return "medium";
  if (LOW_RISK_MUTATION_TOOLS.has(tool)) return "low";
  return "low";
}

function confirmationMode(): "destructive" | "risky" | "all_mutations" {
  const mode = process.env.CRM_CONFIRMATION_MODE;
  if (mode === "destructive" || mode === "all_mutations") return mode;
  return "risky";
}

export function requiresCrmToolConfirmation(tool: string): {
  required: boolean;
  riskLevel: RiskLevel;
} {
  const riskLevel = getCrmToolRiskLevel(tool);
  const mode = confirmationMode();

  if (mode === "all_mutations") {
    return {
      required: LOW_RISK_MUTATION_TOOLS.has(tool) ||
        MEDIUM_RISK_MUTATION_TOOLS.has(tool) ||
        WORKFLOW_TOOLS.has(tool) ||
        DELETE_TOOLS.has(tool),
      riskLevel,
    };
  }

  if (mode === "destructive") {
    return {
      required: WORKFLOW_TOOLS.has(tool) || DELETE_TOOLS.has(tool),
      riskLevel,
    };
  }

  return {
    required: MEDIUM_RISK_MUTATION_TOOLS.has(tool) ||
      WORKFLOW_TOOLS.has(tool) ||
      DELETE_TOOLS.has(tool),
    riskLevel,
  };
}

export function authorizeCrmTool(params: {
  tool: string;
  senderRole: SenderRole;
  operator?: CrmOperator | null;
}): { allowed: boolean; requiredScope: string | null; reason: string | null } {
  const requiredScope = requiredScopeForTool(params.tool);
  if (!requiredScope) {
    return { allowed: true, requiredScope, reason: null };
  }

  // Legacy founder/admin fallback: only used until crm_operators is fully seeded.
  if (!params.operator && params.senderRole === "founder_admin") {
    return { allowed: true, requiredScope, reason: null };
  }

  if (params.operator?.role === "admin" && params.operator.active) {
    return { allowed: true, requiredScope, reason: null };
  }

  if (hasOperatorScope(params.operator ?? null, requiredScope)) {
    return { allowed: true, requiredScope, reason: null };
  }

  return {
    allowed: false,
    requiredScope,
    reason: `Non hai il permesso "${requiredScope}" per eseguire questo comando.`,
  };
}
