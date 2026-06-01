import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, updateWorkflow } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

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

    const targetStatus = typeof body.status === "string" ? body.status : "active";
    if (!["active", "paused", "draft", "archived"].includes(targetStatus)) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }

    const updated = await updateWorkflow(id, { status: targetStatus as Parameters<typeof updateWorkflow>[1]["status"] });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'attivazione del workflow" },
      { status: 500 },
    );
  }
}
