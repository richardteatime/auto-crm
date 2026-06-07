import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listWorkflows, createWorkflow } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.string().optional(),
  triggerConfig: z.string().optional(),
  nodes: z.string().optional(),
  edges: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const workflows = await listWorkflows();
    return NextResponse.json(workflows);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero dei workflow" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

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
    const workflow = await createWorkflow({
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() ?? null,
      triggerType: parsed.data.triggerType,
      triggerConfig: parsed.data.triggerConfig,
      nodes: parsed.data.nodes,
      edges: parsed.data.edges,
      createdBy: auth.user.id,
    });
    return NextResponse.json(workflow, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione del workflow" },
      { status: 500 },
    );
  }
}
