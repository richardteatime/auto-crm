import { NextRequest, NextResponse } from "next/server";
import { listActiveWorkflowsByTrigger } from "@/lib/db";
import { WorkflowExecutor } from "@/lib/workflows/executor";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const triggerType = typeof body.triggerType === "string" ? body.triggerType : "";
  const payload = body.payload ?? {};

  if (!triggerType) {
    return NextResponse.json({ error: "triggerType è obbligatorio" }, { status: 400 });
  }

  try {
    const workflows = await listActiveWorkflowsByTrigger(triggerType);
    const executor = new WorkflowExecutor();
    const results = [];

    for (const workflow of workflows) {
      const result = await executor.run(workflow, payload);
      results.push({ workflowId: workflow.id, runId: result.runId, status: result.status });
    }

    return NextResponse.json({ triggered: results.length, results });
  } catch (e) {
    return NextResponse.json(
      { error: "Errore nel trigger dei workflow", detail: String(e) },
      { status: 500 },
    );
  }
}
