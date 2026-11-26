import { NextRequest, NextResponse } from "next/server";
import { getOpportunity, updateOpportunity } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(_req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const opp = await getOpportunity(id);
  if (!opp) return NextResponse.json({ error: "Opportunità non trovata" }, { status: 404 });
  return NextResponse.json(opp);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

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
  // status is not editable here: use /close (and DELETE /close to reopen) and /convert

  try {
    const result = await updateOpportunity(id, patch);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento" },
      { status: 500 }
    );
  }
}

// Opportunities are never deleted: close them (POST /api/opportunities/[id]/close) so they stay in the history
export async function DELETE() {
  return NextResponse.json(
    { error: "Le opportunità non si eliminano: chiudile come perse, restano nello storico del cliente" },
    { status: 405 }
  );
}
