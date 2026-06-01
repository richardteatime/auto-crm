/**
 * Workflow Worker — Standalone polling script for scheduled workflow delays.
 *
 * Usage:
 *   npx tsx scripts/workflow-worker.ts
 *
 * Environment (from .env.local):
 *   WORKFLOW_WORKER_URL      — Base URL of the CRM (default: http://localhost:3000)
 *   WORKFLOW_WORKER_SECRET   — Shared secret for the API route
 *   WORKFLOW_POLL_INTERVAL   — Seconds between polls (default: 60)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const BASE_URL = process.env.WORKFLOW_WORKER_URL || "http://localhost:3000";
const SECRET = process.env.WORKFLOW_WORKER_SECRET || "";
const INTERVAL_SEC = parseInt(process.env.WORKFLOW_POLL_INTERVAL || "60", 10);

async function tick() {
  const url = `${BASE_URL}/api/workflow/process-scheduled`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SECRET ? { "x-worker-secret": SECRET } : {}),
      },
    });

    if (res.status === 401) {
      console.error("[worker] Unauthorized — check WORKFLOW_WORKER_SECRET");
      return;
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`[worker] HTTP ${res.status}: ${text}`);
      return;
    }

    const data = await res.json();
    if (data.processed > 0) {
      console.log(`[worker] Processed ${data.processed} scheduled item(s)`);
      for (const r of data.results || []) {
        console.log(`[worker]   ${r.id} → ${r.status}${r.error ? " (" + r.error + ")" : ""}`);
      }
    }
  } catch (e) {
    console.error("[worker] Fetch error:", e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  console.log(`[worker] Starting — polling every ${INTERVAL_SEC}s → ${BASE_URL}`);
  await tick();
  setInterval(tick, INTERVAL_SEC * 1000);
}

main();
