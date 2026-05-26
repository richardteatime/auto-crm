import type { SenderRole, RunStatus, RiskLevel, OrchestratorRun } from "./types";

// Graceful import: if the collection doesn't exist yet, we don't crash
let dbModule: typeof import("@/lib/db/orchestrator-runs") | null = null;
try {
  dbModule = await import("@/lib/db/orchestrator-runs");
} catch {
  dbModule = null;
}

export async function createRun(data: {
  source: string;
  senderPhone: string | null;
  senderRole: SenderRole;
  commandText: string;
  intent?: string;
  workflow?: string | null;
  status?: RunStatus;
  riskLevel?: RiskLevel;
  autodeploy?: boolean;
  conversationId?: string | null;
}): Promise<OrchestratorRun | null> {
  if (!dbModule) {
    console.error("[orchestrator/runs] DB module not available (collection may not exist yet)");
    return null;
  }
  try {
    return await dbModule.createOrchestratorRun(data);
  } catch (err) {
    console.error("[orchestrator/runs] createRun failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function updateRun(
  id: string,
  data: Partial<{
    contactId: string | null;
    dealId: string | null;
    projectId: string | null;
    intent: string;
    workflow: string | null;
    status: RunStatus;
    resultSummary: string | null;
    riskLevel: RiskLevel;
    autodeploy: boolean;
    currentStep: string | null;
    finalUrl: string | null;
    repoUrl: string | null;
    conversationId: string | null;
    error: string | null;
  }>,
): Promise<OrchestratorRun | null> {
  if (!dbModule) {
    console.error("[orchestrator/runs] DB module not available");
    return null;
  }
  try {
    return await dbModule.updateOrchestratorRun(id, data);
  } catch (err) {
    console.error("[orchestrator/runs] updateRun failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function listRuns(filters?: {
  status?: RunStatus;
  senderPhone?: string;
  limit?: number;
}): Promise<OrchestratorRun[]> {
  if (!dbModule) return [];
  try {
    return await dbModule.listOrchestratorRuns(filters);
  } catch (err) {
    console.error("[orchestrator/runs] listRuns failed:", err instanceof Error ? err.message : err);
    return [];
  }
}
