import { NextRequest, NextResponse } from "next/server";
import { getOpportunity, updateOpportunity, deleteOpportunity } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const opp = await getOpportunity(id);
  if (!opp) return NextResponse.json({ error: "Opportunità non trovata" }, { status: 404 });
  return NextResponse.json(opp);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const existing = await getOpportunity(id);
  if (!existing) return NextResponse.json({ error: "Opportunità non trovata" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.attachments !== undefined) patch.attachments = body.attachments;
  if (body.value !== undefined) patch.value = body.value != null ? Math.round(body.value * 100) : null;
  if (body.status !== undefined) patch.status = body.status;

  try {
    const result = await updateOpportunity(id, patch);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nell'aggiornamento: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getOpportunity(id);
  if (!existing) return NextResponse.json({ error: "Opportunità non trovata" }, { status: 404 });
  try {
    await deleteOpportunity(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nell'eliminazione: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}
