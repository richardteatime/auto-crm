import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWorkflow, updateWorkflow } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  status: z.enum(["active", "paused", "draft", "archived"]).optional(),
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

    const targetStatus = parsed.data.status ?? "active";
    const updated = await updateWorkflow(id, { status: targetStatus });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'attivazione del workflow" },
      { status: 500 },
    );
  }
}
