import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWorkflow, updateWorkflow, deleteWorkflow } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  triggerType: z.string().optional(),
  triggerConfig: z.string().optional(),
  nodes: z.string().optional(),
  edges: z.string().optional(),
});

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

    const updateData: Parameters<typeof updateWorkflow>[1] = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.triggerType !== undefined) updateData.triggerType = parsed.data.triggerType;
    if (parsed.data.triggerConfig !== undefined) updateData.triggerConfig = parsed.data.triggerConfig;
    if (parsed.data.nodes !== undefined) updateData.nodes = parsed.data.nodes;
    if (parsed.data.edges !== undefined) updateData.edges = parsed.data.edges;

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
