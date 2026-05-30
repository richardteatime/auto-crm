import type { SenderRole, RunStatus, RiskLevel, OrchestratorRun } from "./types";

// Lazy import to avoid top-level await (keeps scripts compatible with CJS transform)
let dbModule: typeof import("@/lib/db/orchestrator-runs") | null = null;

async function getDbModule() {
  if (dbModule) return dbModule;
  try {
    dbModule = await import("@/lib/db/orchestrator-runs");
  } catch {
    dbModule = null;
  }
  return dbModule;
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
  const db = await getDbModule();
  if (!db) {
    console.error("[orchestrator/runs] DB module not available (collection may not exist yet)");
    return null;
  }
  try {
    return await db.createOrchestratorRun(data);
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
  const db = await getDbModule();
  if (!db) {
    console.error("[orchestrator/runs] DB module not available");
    return null;
  }
  try {
    return await db.updateOrchestratorRun(id, data);
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
  const db = await getDbModule();
  if (!db) return [];
  try {
    return await db.listOrchestratorRuns(filters);
  } catch (err) {
    console.error("[orchestrator/runs] listRuns failed:", err instanceof Error ? err.message : err);
    return [];
  }
}
