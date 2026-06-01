import { NextRequest, NextResponse } from "next/server";
import { listWorkflowScheduled, updateWorkflowScheduled, deleteWorkflowScheduled } from "@/lib/db";
import { WorkflowExecutor } from "@/lib/workflows/executor";

// This endpoint is meant to be called by the worker or a cron job.
// It processes pending scheduled workflow steps that are due.
export async function POST(request: NextRequest) {
  // Optional secret validation for security
  const secret = request.headers.get("x-worker-secret");
  const expected = process.env.WORKFLOW_WORKER_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const scheduled = await listWorkflowScheduled("pending", now);
    const executor = new WorkflowExecutor();
    const results = [];

    for (const item of scheduled) {
      try {
        await updateWorkflowScheduled(item.id, { status: "processing" });
        const result = await executor.resumeFromScheduled(item);
        results.push({ id: item.id, status: result.status });
        await deleteWorkflowScheduled(item.id);
      } catch (e) {
        results.push({ id: item.id, status: "failed", error: String(e) });
        await updateWorkflowScheduled(item.id, { status: "pending" });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (e) {
    return NextResponse.json(
      { error: "Errore nel processamento schedulato", detail: String(e) },
      { status: 500 },
    );
  }
}
