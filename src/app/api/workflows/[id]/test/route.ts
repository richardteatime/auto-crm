import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWorkflow } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { WorkflowExecutor } from "@/lib/workflows/executor";

const BodySchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
});

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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const workflow = await getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow non trovato" }, { status: 404 });
    }

    const payload = parsed.data.payload ?? {};
    const executor = new WorkflowExecutor();
    const result = await executor.runTest(workflow, payload);

    // Debug log: stampa sempre sulla console del server cosi possiamo
    // diagnosticare i fallimenti senza dipendere dal frontend.
    console.log("[workflow-test] result:", JSON.stringify(result, null, 2));

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[workflow-test] exception:", err);
    return NextResponse.json(
      { error: "Errore nell'esecuzione di test", detail: err },
      { status: 500 },
    );
  }
}
