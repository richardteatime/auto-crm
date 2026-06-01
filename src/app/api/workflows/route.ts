import { NextRequest, NextResponse } from "next/server";
import { listWorkflows, createWorkflow } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Il nome è obbligatorio" }, { status: 400 });
  }

  try {
    const workflow = await createWorkflow({
      name,
      description: typeof body.description === "string" ? body.description.trim() : null,
      triggerType: typeof body.triggerType === "string" ? body.triggerType : undefined,
      triggerConfig: typeof body.triggerConfig === "string" ? body.triggerConfig : undefined,
      nodes: typeof body.nodes === "string" ? body.nodes : undefined,
      edges: typeof body.edges === "string" ? body.edges : undefined,
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
