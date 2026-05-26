import { updateRun } from "@/lib/orchestrator/runs";
import { logWorkflowEvent } from "@/lib/orchestrator/logger";
import { createAgentTask } from "@/lib/db/agent-tasks";
import { ORCHESTRATOR_CONFIG } from "@/lib/orchestrator/config";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const GITAGENT_ENDPOINT = process.env.GITAGENT_ENDPOINT || "";
const GITAGENT_API_KEY = process.env.GITAGENT_API_KEY || "";
const GITAGENT_CALLBACK_SECRET = process.env.GITAGENT_CALLBACK_SECRET || "";

export function getGitAgentCallbackSecret(): string {
  return GITAGENT_CALLBACK_SECRET;
}

export function isGitAgentConfigured(): boolean {
  return Boolean(GITAGENT_ENDPOINT && GITAGENT_API_KEY && ORCHESTRATOR_CONFIG.enableGitAgentDispatch);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitAgentPayload {
  runId: string;
  task: string;
  workflow: string;
  projectId: string | null;
  contactId: string | null;
  clientName: string | null;
  appType: string;
  stack: string;
  template?: string;
  autodeploy: boolean;
  riskLevel: string;
  callbackUrl: string;
}

export interface GitAgentDispatchResult {
  success: boolean;
  taskId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function dispatchToGitAgent(payload: GitAgentPayload): Promise<GitAgentDispatchResult> {
  if (!ORCHESTRATOR_CONFIG.enableGitAgentDispatch) {
    return {
      success: false,
      error: "GitAgent dispatch è disabilitato (ENABLE_GITAGENT_DISPATCH=false).",
    };
  }

  if (!GITAGENT_ENDPOINT) {
    return {
      success: false,
      error: "GitAgent endpoint non configurato (GITAGENT_ENDPOINT mancante).",
    };
  }

  if (!GITAGENT_API_KEY) {
    return {
      success: false,
      error: "GitAgent API key non configurata (GITAGENT_API_KEY mancante).",
    };
  }

  // Create tracking task
  let agentTaskId: string | undefined;
  try {
    const task = await createAgentTask({
      runId: payload.runId,
      agentName: "gitagent",
      taskType: payload.task,
      status: "running",
      input: JSON.stringify(payload),
      startedAt: new Date(),
    });
    agentTaskId = task.id;
  } catch (err) {
    console.error("[gitagent-dispatcher] Failed to create agent_task:", err);
    // Non-blocking: continue dispatch even if task tracking fails
  }

  // Build callback URL if not provided
  const callbackUrl =
    payload.callbackUrl ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/orchestrator/callback/gitagent`
      : "");

  const body = {
    ...payload,
    callbackUrl,
  };

  try {
    const res = await fetch(GITAGENT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GITAGENT_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new Error(`GitAgent returned ${res.status}: ${text}`);
    }

    await logWorkflowEvent({
      runId: payload.runId,
      eventType: "gitagent_dispatched",
      message: `GitAgent dispatch inviato: ${payload.task}`,
      metadata: { runId: payload.runId, task: payload.task, callbackUrl },
    });

    await updateRun(payload.runId, {
      status: "dispatched",
      currentStep: "gitagent_dispatched",
    });

    return { success: true, taskId: agentTaskId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    await logWorkflowEvent({
      runId: payload.runId,
      eventType: "error",
      message: `GitAgent dispatch fallito: ${msg}`,
      metadata: { error: msg },
    });

    // Mark task as failed if we created one
    if (agentTaskId) {
      try {
        const { updateAgentTask } = await import("@/lib/db/agent-tasks");
        await updateAgentTask(agentTaskId, { status: "failed", error: msg });
      } catch {
        // ignore
      }
    }

    await updateRun(payload.runId, {
      status: "failed",
      error: msg,
      currentStep: "gitagent_dispatch_failed",
    });

    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Build payload helpers
// ---------------------------------------------------------------------------

export function buildGitAgentPayload(params: {
  runId: string;
  workflow: string;
  projectId: string | null;
  contactId: string | null;
  clientName: string | null;
  appType?: string;
  stack?: string;
  autodeploy?: boolean;
  riskLevel?: string;
}): GitAgentPayload {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return {
    runId: params.runId,
    task: params.workflow === "generate_app" ? "generate_app" : "generate_static_site",
    workflow: params.workflow,
    projectId: params.projectId,
    contactId: params.contactId,
    clientName: params.clientName,
    appType: params.appType || "static_site",
    stack: params.stack || "html_php_admin",
    autodeploy: params.autodeploy ?? true,
    riskLevel: params.riskLevel || "low",
    callbackUrl: appUrl ? `${appUrl}/api/orchestrator/callback/gitagent` : "",
  };
}
