#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Hermes Webhook E2E Test (with conversation memory)
// ---------------------------------------------------------------------------
// Uso:
//   npx tsx scripts/test-hermes-webhook-e2e.ts
//
// Requisiti:
//   - Appwrite configurato (.env.local)
//   - Hermes installato e configurato con MCP auto-crm
// ---------------------------------------------------------------------------

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

import { createServer } from "http";
import type { Server } from "http";
import type { NextRequest } from "next/server";

// Env setup — PRIMA di importare il progetto
process.env.CHATWOOT_URL = "http://localhost:9999";
process.env.CHATWOOT_ACCOUNT_ID = "1";
process.env.CHATWOOT_API_ACCESS_TOKEN = "test-token";
process.env.ADMIN_WHATSAPP_NUMBERS = "+3912345678901";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

const capturedMessages: Array<{ conversationId: number; content: string }> = [];

function startMockChatwoot(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const messagesMatch = req.url?.match(
        /\/api\/v1\/accounts\/\d+\/conversations\/(\d+)\/messages/,
      );
      if (messagesMatch && req.method === "POST") {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            capturedMessages.push({
              conversationId: parseInt(messagesMatch[1], 10),
              content: parsed.content || "",
            });
          } catch {
            /* ignore */
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: Date.now() }));
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(9999, () => {
      console.log("[mock] Chatwoot mock listening on :9999");
      resolve(server);
    });
  });
}

async function sendWebhook(
  POST: (req: NextRequest) => Promise<Response>,
  content: string,
  conversationId: number,
) {
  const payload = {
    event: "message_created",
    message_type: "incoming",
    id: Date.now(),
    content,
    conversation: { id: conversationId },
    sender: {
      name: "Franc",
      phone_number: "+3912345678901",
    },
  };

  const request = new Request("http://localhost:3000/api/chatwoot/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": process.env.CHATWOOT_WEBHOOK_SECRET || "",
    },
    body: JSON.stringify(payload),
  });

  return POST(request as NextRequest);
}

async function main() {
  const mockServer = await startMockChatwoot();

  // Import route handler dynamically AFTER env vars are set
  const { POST } = await import("@/app/api/chatwoot/webhook/route");

  // ── Turn 1: Create contact ────────────────────────────────────────────────
  console.log("[e2e] Turn 1: Creating contact...");
  const t1Start = Date.now();
  const r1 = await sendWebhook(
    POST,
    "Crea un contatto di test E2E chiamato Test-Memory con email memory@test.com",
    8889,
  );
  const d1 = await r1.json();
  console.log("[e2e] Turn 1 response:", JSON.stringify(d1, null, 2));
  console.log("[e2e] Turn 1 elapsed:", Date.now() - t1Start, "ms");

  // ── Turn 2: Ask about the contact (tests memory) ─────────────────────────
  await new Promise((r) => setTimeout(r, 1000));
  console.log("[e2e] Turn 2: Asking about previous contact...");
  const t2Start = Date.now();
  const r2 = await sendWebhook(
    POST,
    "Qual è l'email del contatto che abbiamo appena creato?",
    8889,
  );
  const d2 = await r2.json();
  console.log("[e2e] Turn 2 response:", JSON.stringify(d2, null, 2));
  console.log("[e2e] Turn 2 elapsed:", Date.now() - t2Start, "ms");

  // ── Verify ───────────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 2000));

  const msgsForConv = capturedMessages.filter((m) => m.conversationId === 8889);
  console.log("[e2e] Captured messages for conv 8889:", msgsForConv.length);
  for (const m of msgsForConv) {
    console.log(`  - ${m.content.slice(0, 150)}...`);
  }

  let failed = false;

  if (msgsForConv.length < 2) {
    console.error("❌ FAILED: Expected 2 replies, got", msgsForConv.length);
    failed = true;
  }

  const turn1Reply = msgsForConv[0]?.content || "";
  const turn2Reply = msgsForConv[1]?.content || "";

  if (!turn1Reply.toLowerCase().includes("test-memory")) {
    console.error("❌ FAILED: Turn 1 reply does not mention contact name");
    failed = true;
  }

  if (!turn2Reply.toLowerCase().includes("memory@test.com")) {
    console.error("❌ FAILED: Turn 2 reply does not remember the email (conversation memory broken)");
    failed = true;
  }

  if (!failed) {
    console.log("✅ E2E PASSED: Hermes handled multi-turn conversation with memory");
  } else {
    process.exitCode = 1;
  }

  mockServer.closeAllConnections?.();
  mockServer.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
