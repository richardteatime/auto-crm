import { NextRequest, NextResponse } from "next/server";
import { getOrchestratorRun, updateOrchestratorRun } from "@/lib/db/orchestrator-runs";
import { createDeploymentResult } from "@/lib/db/deployment-results";
import { logWorkflowEvent } from "@/lib/orchestrator/logger";
import { sendChatwootMessage } from "@/lib/chatwoot/client";

const DEPLOY_CALLBACK_SECRET = process.env.DEPLOY_CALLBACK_SECRET || "";

export async function POST(req: NextRequest) {
  // 1. Validate secret
  if (DEPLOY_CALLBACK_SECRET) {
    const headerSecret = req.headers.get("x-deploy-callback-secret");
    if (headerSecret !== DEPLOY_CALLBACK_SECRET) {
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
    projectId?: string;
    status?: string;
    environment?: string;
    url?: string;
    provider?: string;
    healthcheckStatus?: string;
  };

  if (!payload.runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  const run = await getOrchestratorRun(payload.runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // 2. Save deployment result
  try {
    await createDeploymentResult({
      runId: payload.runId,
      projectId: payload.projectId ?? run.projectId,
      environment: (payload.environment as "preview" | "staging" | "production") ?? "preview",
      status: payload.status ?? "unknown",
      url: payload.url ?? null,
      provider: payload.provider ?? "unknown",
      healthcheckStatus: payload.healthcheckStatus ?? null,
    });
  } catch (err) {
    console.error("[deploy-callback] Failed to save deployment result:", err);
  }

  // 3. Update run with finalUrl
  const isSuccess = payload.status === "success" || payload.status === "completed";
  await updateOrchestratorRun(payload.runId, {
    status: isSuccess ? "completed" : "failed",
    finalUrl: payload.url ?? null,
    currentStep: isSuccess ? "deploy_completed" : "deploy_failed",
  });

  // 4. Log event
  await logWorkflowEvent({
    runId: payload.runId,
    eventType: "deploy_callback_received",
    message: `Deploy callback: ${payload.status}`,
    metadata: {
      status: payload.status,
      url: payload.url,
      provider: payload.provider,
      environment: payload.environment,
    },
  });

  // 5. If success, log final_url_saved and notify Chatwoot
  if (isSuccess && payload.url) {
    await logWorkflowEvent({
      runId: payload.runId,
      eventType: "final_url_saved",
      message: `URL finale salvata: ${payload.url}`,
      metadata: { url: payload.url },
    });

    // Notify Chatwoot if conversationId is available
    if (run.conversationId) {
      try {
        const convId = parseInt(run.conversationId, 10);
        if (!Number.isNaN(convId)) {
          await sendChatwootMessage(
            convId,
            `App deployata con successo.\n\nLink: ${payload.url}`,
          );

          await logWorkflowEvent({
            runId: payload.runId,
            eventType: "reply_sent",
            message: "Notifica deploy inviata su Chatwoot",
            metadata: { conversationId: convId, url: payload.url },
          });
        }
      } catch (err) {
        console.error("[deploy-callback] Failed to send Chatwoot message:", err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    runId: payload.runId,
    status: isSuccess ? "completed" : "failed",
    url: payload.url,
  });
}
