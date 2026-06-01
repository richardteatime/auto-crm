import { NextRequest, NextResponse } from "next/server";
import { deleteFunnel, getFunnel, updateFunnel } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { FunnelStatus } from "@/lib/capture/types";

const STATUSES: FunnelStatus[] = ["draft", "active", "archived"];

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

  const patch: Parameters<typeof updateFunnel>[1] = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.steps === "string") {
    try {
      const parsed = JSON.parse(body.steps);
      if (!Array.isArray(parsed)) throw new Error();
      patch.steps = body.steps;
    } catch {
      return NextResponse.json({ error: "Step non validi" }, { status: 400 });
    }
  }
  if (body.thankYouPageId === null || typeof body.thankYouPageId === "string") {
    patch.thankYouPageId = body.thankYouPageId || null;
  }
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as FunnelStatus)) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }
    patch.status = body.status as FunnelStatus;
  }

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
