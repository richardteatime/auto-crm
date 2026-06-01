import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, listWorkflowRuns } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const workflow = await getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow non trovato" }, { status: 404 });
    }

    const runs = await listWorkflowRuns(id);
    return NextResponse.json(runs);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero delle esecuzioni" },
      { status: 500 },
    );
  }
}
