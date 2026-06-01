import { NextRequest, NextResponse } from "next/server";
import { getWorkflow } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { WorkflowExecutor } from "@/lib/workflows/executor";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // body optional
  }

  try {
    const workflow = await getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow non trovato" }, { status: 404 });
    }

    const payload = body.payload ?? {};
    const executor = new WorkflowExecutor();
    const result = await executor.runTest(workflow, payload);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "Errore nell'esecuzione di test", detail: String(e) },
      { status: 500 },
    );
  }
}
