import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteFunnel, getFunnel, updateFunnel } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  name: z.string().min(1).optional(),
  steps: z.string().optional(),
  thankYouPageId: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const funnel = await getFunnel(id);
  return funnel
    ? NextResponse.json(funnel)
    : NextResponse.json({ error: "Funnel non trovato" }, { status: 404 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;

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

  const patch: Parameters<typeof updateFunnel>[1] = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.steps !== undefined) {
    try {
      const parsedSteps = JSON.parse(parsed.data.steps);
      if (!Array.isArray(parsedSteps)) throw new Error();
      patch.steps = parsed.data.steps;
    } catch {
      return NextResponse.json({ error: "Step non validi" }, { status: 400 });
    }
  }
  if (parsed.data.thankYouPageId !== undefined) {
    patch.thankYouPageId = parsed.data.thankYouPageId;
  }
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;

  try {
    return NextResponse.json(await updateFunnel(id, patch));
  } catch {
    return NextResponse.json({ error: "Errore nel salvataggio" }, { status: 500 });
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
    await deleteFunnel(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Errore nell'eliminazione" }, { status: 500 });
  }
}
