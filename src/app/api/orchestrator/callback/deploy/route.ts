import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrchestratorRun, updateOrchestratorRun } from "@/lib/db/orchestrator-runs";
import { createDeploymentResult } from "@/lib/db/deployment-results";
import { logWorkflowEvent } from "@/lib/orchestrator/logger";
import { sendChatwootMessage } from "@/lib/chatwoot/client";
import { getProject } from "@/lib/db/projects";
import { getContact } from "@/lib/db/contacts";

const DEPLOY_CALLBACK_SECRET = process.env.DEPLOY_CALLBACK_SECRET;

const BodySchema = z.object({
  runId: z.string().min(1),
  projectId: z.string().optional(),
  status: z.string().optional(),
  environment: z.string().optional(),
  url: z.string().optional(),
  provider: z.string().optional(),
  healthcheckStatus: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // 1. Validate secret — mandatory
  const headerSecret = req.headers.get("x-deploy-callback-secret");
  if (!DEPLOY_CALLBACK_SECRET || headerSecret !== DEPLOY_CALLBACK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const payload = parsed.data;

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

    // Enrich notification with project and contact info
    let clientName = "Cliente";
    let appType = "app";
    try {
      if (run.projectId) {
        const project = await getProject(run.projectId);
        if (project) {
          appType = project.title || "app";
          if (project.contactId) {
            const contact = await getContact(project.contactId);
            if (contact) {
              clientName = contact.name;
            }
          }
        }
      }
    } catch (err) {
      console.error("[deploy-callback] Failed to enrich notification:", err);
    }

    const deployMessage =
      `App deployata con successo.\n\n` +
      `Cliente: ${clientName}\n` +
      `Tipo: ${appType}\n` +
      `Link: ${payload.url}\n` +
      `QA: ${payload.healthcheckStatus || "N/A"}\n` +
      `Deploy: completed`;

    // Notify Chatwoot if conversationId is available
    if (run.conversationId) {
      try {
        const convId = parseInt(run.conversationId, 10);
        if (!Number.isNaN(convId)) {
          await sendChatwootMessage(convId, deployMessage);

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
