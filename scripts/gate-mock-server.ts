#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Gate Mock Server — Simula GitAgent + Deploy Adapter per testare il Gate E2E
// -----------------------------------------------------------------------------
// Uso:
//   npx tsx scripts/gate-mock-server.ts
//
// Cosa fa:
//   1. Espone POST http://localhost:4000/api/dispatch (simula GitAgent)
//   2. Risponde subito 200 OK con taskId fittizio
//   3. Dopo 3s chiama il callback GitAgent di Auto-CRM con status "completed"
//      e deployRequested = true
//   4. Dopo altri 2s chiama il callback Deploy di Auto-CRM con status "success"
//      e url fittizia
//
// Configurazione .env.local necessaria:
//   ENABLE_INTERNAL_COMMANDS=true
//   ENABLE_GITAGENT_DISPATCH=true
//   ENABLE_AUTODEPLOY_PREVIEW=true
//   GITAGENT_ENDPOINT=http://localhost:4000/api/dispatch
//   GITAGENT_API_KEY=fake-key
//   GITAGENT_CALLBACK_SECRET=mock-secret
//   DEPLOY_CALLBACK_SECRET=mock-secret
//   NEXT_PUBLIC_APP_URL=http://localhost:3000
// -----------------------------------------------------------------------------

import { createServer, type IncomingMessage, type ServerResponse } from "http";

const PORT = Number(process.env.GATE_MOCK_PORT || 4000);
const GITAGENT_SECRET = process.env.GITAGENT_CALLBACK_SECRET || "mock-secret";
const DEPLOY_SECRET = process.env.DEPLOY_CALLBACK_SECRET || "mock-secret";
const CRM_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname === "/api/dispatch" && req.method === "POST") {
    return handleGitAgentDispatch(req, res);
  }

  if (url.pathname === "/health" && req.method === "GET") {
    return json(res, 200, { status: "ok", mock: true });
  }

  return json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`[gate-mock] Server running at http://localhost:${PORT}`);
  console.log(`[gate-mock] Endpoints:`);
  console.log(`  POST http://localhost:${PORT}/api/dispatch  -> simula GitAgent`);
  console.log(`  GET  http://localhost:${PORT}/health         -> health check`);
  console.log(`[gate-mock] CRM callback base: ${CRM_BASE_URL}`);
});

// ---------------------------------------------------------------------------
// GitAgent dispatch handler
// ---------------------------------------------------------------------------

async function handleGitAgentDispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const raw = await readBody(req);
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return json(res, 400, { error: "Invalid JSON" });
  }

  const runId = body.runId as string | undefined;
  const callbackUrl = (body.callbackUrl as string) || "";
  const workflow = (body.workflow as string) || "generate_app";
  const clientName = (body.clientName as string) || "cliente";

  if (!runId) {
    return json(res, 400, { error: "Missing runId" });
  }

  console.log(`[gate-mock] Ricevuto dispatch per runId=${runId}, workflow=${workflow}, client=${clientName}`);

  // Fase 1: simula build/generazione
  setTimeout(() => {
    callGitAgentCallback(runId, callbackUrl, workflow, clientName).catch((err) =>
      console.error("[gate-mock] GitAgent callback failed:", err),
    );
  }, 3000);

  return json(res, 200, { success: true, taskId: `mock-task-${Date.now()}` });
}

// ---------------------------------------------------------------------------
// Callback GitAgent -> CRM
// ---------------------------------------------------------------------------

async function callGitAgentCallback(
  runId: string,
  callbackUrl: string,
  workflow: string,
  clientName: string,
): Promise<void> {
  const url = callbackUrl || `${CRM_BASE_URL}/api/orchestrator/callback/gitagent`;
  const repoName =
    workflow === "generate_app"
      ? `${clientName.toLowerCase().replace(/\s+/g, "-")}-app`
      : `${clientName.toLowerCase().replace(/\s+/g, "-")}-site`;

  const payload = {
    runId,
    status: "completed",
    repoUrl: `https://github.com/sarconx-mock/${repoName}`,
    branch: "main",
    qaStatus: "passed",
    artifacts: [
      { type: "repo", name: "source-code", url: `https://github.com/sarconx-mock/${repoName}` },
      { type: "build_log", name: "build.log", content: "Build successful. No errors." },
    ],
    deployRequested: true,
  };

  console.log(`[gate-mock] Invio callback GitAgent -> ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gitagent-callback-secret": GITAGENT_SECRET,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    console.error(`[gate-mock] GitAgent callback risposta ${res.status}: ${text}`);
    return;
  }

  console.log(`[gate-mock] GitAgent callback OK. Ora simulo deploy...`);

  // Fase 2: simula deploy
  setTimeout(() => {
    callDeployCallback(runId, clientName).catch((err) =>
      console.error("[gate-mock] Deploy callback failed:", err),
    );
  }, 2000);
}

// ---------------------------------------------------------------------------
// Callback Deploy -> CRM
// ---------------------------------------------------------------------------

async function callDeployCallback(runId: string, clientName: string): Promise<void> {
  const url = `${CRM_BASE_URL}/api/orchestrator/callback/deploy`;
  const siteName = clientName.toLowerCase().replace(/\s+/g, "-");
  const previewUrl = `https://${siteName}-preview.mockdeploy.dev`;

  const payload = {
    runId,
    status: "success",
    environment: "preview",
    url: previewUrl,
    provider: "mock-deploy",
    healthcheckStatus: "healthy",
  };

  console.log(`[gate-mock] Invio callback Deploy -> ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-deploy-callback-secret": DEPLOY_SECRET,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    console.error(`[gate-mock] Deploy callback risposta ${res.status}: ${text}`);
    return;
  }

  console.log(`[gate-mock] Deploy callback OK. Gate completato per runId=${runId}`);
  console.log(`[gate-mock] URL finale: ${previewUrl}`);
}
