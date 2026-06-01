import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, updateWorkflow, deleteWorkflow } from "@/lib/db";
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
    return NextResponse.json(workflow);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero del workflow" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  try {
    const workflow = await getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow non trovato" }, { status: 404 });
    }

    const updateData: Parameters<typeof updateWorkflow>[1] = {};
    if (typeof body.name === "string") updateData.name = body.name.trim();
    if (typeof body.description === "string" || body.description === null) updateData.description = body.description;
    if (typeof body.status === "string") updateData.status = body.status;
    if (typeof body.triggerType === "string") updateData.triggerType = body.triggerType;
    if (typeof body.triggerConfig === "string") updateData.triggerConfig = body.triggerConfig;
    if (typeof body.nodes === "string") updateData.nodes = body.nodes;
    if (typeof body.edges === "string") updateData.edges = body.edges;

    const updated = await updateWorkflow(id, updateData);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento del workflow" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    await deleteWorkflow(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'eliminazione del workflow" },
      { status: 500 },
    );
  }
}
