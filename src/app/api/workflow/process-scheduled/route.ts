import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { listWorkflowScheduled, updateWorkflowScheduled, deleteWorkflowScheduled, getWorkflowScheduled } from "@/lib/db";
import { WorkflowExecutor } from "@/lib/workflows/executor";

// This endpoint is meant to be called by the worker or a cron job.
// It processes pending scheduled workflow steps that are due.
// Lock-token pattern: each worker claims items with a unique UUID,
// then re-reads to verify it won the race before executing.
export async function POST(request: NextRequest) {
  // Mandatory secret validation
  const secret = request.headers.get("x-worker-secret");
  const expected = process.env.WORKFLOW_WORKER_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const scheduled = await listWorkflowScheduled("pending", now);
    const executor = new WorkflowExecutor();
    const results = [];
    const workerId = randomUUID();

    for (const item of scheduled) {
      try {
        // 1. Claim item by setting status + workerId
        await updateWorkflowScheduled(item.id, {
          status: "processing",
          workerId,
          startedAt: now.toISOString(),
        });

        // 2. Re-read to verify we won the race
        const fresh = await getWorkflowScheduled(item.id);
        if (!fresh || fresh.status !== "processing" || fresh.workerId !== workerId) {
          results.push({ id: item.id, status: "skipped", reason: "claimed_by_other_worker" });
          continue;
        }

        // 3. Execute (idempotent executor)
        const result = await executor.resumeFromScheduled(item);
        results.push({ id: item.id, status: result.status });
        await deleteWorkflowScheduled(item.id);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`[process-scheduled] Failed item ${item.id}:`, errorMessage);
        results.push({ id: item.id, status: "failed" });
        // Reset to pending so another worker can retry
        await updateWorkflowScheduled(item.id, {
          status: "pending",
          workerId: "",
          startedAt: "",
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (e) {
    console.error("[process-scheduled] Worker error:", e);
    return NextResponse.json(
      { error: "Errore nel processamento schedulato" },
      { status: 500 },
    );
  }
}
