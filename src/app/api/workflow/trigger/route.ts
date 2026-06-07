import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listActiveWorkflowsByTrigger } from "@/lib/db";
import { WorkflowExecutor } from "@/lib/workflows/executor";

const BodySchema = z.object({
  triggerType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-workflow-trigger-secret");
  const expected = process.env.WORKFLOW_TRIGGER_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const triggerType = parsed.data.triggerType;
  const payload = parsed.data.payload ?? {};

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
