import { NextRequest, NextResponse } from "next/server";
import { getGitAgentCallbackSecret } from "@/lib/orchestrator/dispatchers/gitagent";
import { getOrchestratorRun, updateOrchestratorRun } from "@/lib/db/orchestrator-runs";
import { createAgentTask } from "@/lib/db/agent-tasks";
import { createProjectArtifact } from "@/lib/db/project-artifacts";
import { logWorkflowEvent } from "@/lib/orchestrator/logger";

export async function POST(req: NextRequest) {
  // 1. Validate secret
  const secret = getGitAgentCallbackSecret();
  if (secret) {
    const headerSecret = req.headers.get("x-gitagent-callback-secret");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as {
    runId?: string;
    status?: string;
    repoUrl?: string;
    branch?: string;
    qaStatus?: string;
    artifacts?: Array<{ type: string; name: string; url?: string; content?: string }>;
    deployRequested?: boolean;
    error?: string;
  };

  if (!payload.runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  const run = await getOrchestratorRun(payload.runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // 2. Update run with repo info
  const updateData: Parameters<typeof updateOrchestratorRun>[1] = {
    repoUrl: payload.repoUrl ?? null,
  };

  if (payload.status === "completed") {
    if (payload.deployRequested) {
      updateData.status = "waiting_for_data";
      updateData.currentStep = "waiting_for_deploy";
    } else {
      updateData.status = "completed";
      updateData.currentStep = "gitagent_completed";
    }
  } else if (payload.status === "failed") {
    updateData.status = "failed";
    updateData.currentStep = "gitagent_failed";
    updateData.error = payload.error ?? "GitAgent failed";
  }

  await updateOrchestratorRun(payload.runId, updateData);

  // 3. Create agent_task record
  try {
    await createAgentTask({
      runId: payload.runId,
      agentName: "gitagent",
      taskType: run.workflow || "unknown",
      status: payload.status === "completed" ? "completed" : "failed",
      input: JSON.stringify({ repoUrl: payload.repoUrl, branch: payload.branch }),
      output: payload.qaStatus ? `QA: ${payload.qaStatus}` : null,
      error: payload.error ?? null,
      startedAt: run.createdAt,
      completedAt: new Date(),
    });
  } catch (err) {
    console.error("[gitagent-callback] Failed to create agent_task:", err);
  }

  // 4. Create project_artifacts
  if (payload.artifacts && Array.isArray(payload.artifacts)) {
    for (const art of payload.artifacts) {
      try {
        await createProjectArtifact({
          runId: payload.runId,
          projectId: run.projectId,
          artifactType: art.type as import("@/lib/orchestrator/types").ArtifactType,
          name: art.name,
          url: art.url ?? null,
          content: art.content ?? null,
        });
      } catch (err) {
        console.error("[gitagent-callback] Failed to create artifact:", err);
      }
    }
  }

  // 5. Log event
  await logWorkflowEvent({
    runId: payload.runId,
    eventType: "gitagent_callback_received",
    message: `GitAgent callback: ${payload.status}`,
    metadata: {
      status: payload.status,
      repoUrl: payload.repoUrl,
      branch: payload.branch,
      qaStatus: payload.qaStatus,
      deployRequested: payload.deployRequested,
      error: payload.error,
    },
  });

  return NextResponse.json({
    success: true,
    runId: payload.runId,
    status: updateData.status,
  });
}
