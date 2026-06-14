import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOpportunity, updateOpportunity, deleteOpportunity } from "@/lib/db";
import { requireAuth, requireOwnerOrAdmin } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/appwrite";

const BodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
  value: z.number().optional().nullable(),
  status: z.string().optional(),
});

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
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(request, COLLECTIONS.opportunities, id);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const existing = await getOpportunity(id);
  if (!existing) return NextResponse.json({ error: "Opportunità non trovata" }, { status: 404 });

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.attachments !== undefined) patch.attachments = parsed.data.attachments;
  if (parsed.data.value !== undefined) patch.value = parsed.data.value != null ? Math.round(parsed.data.value * 100) : null;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(_req, COLLECTIONS.opportunities, id);
  if (auth.error) return auth.error;
  const existing = await getOpportunity(id);
  if (!existing) return NextResponse.json({ error: "Opportunità non trovata" }, { status: 404 });
  try {
    await deleteOpportunity(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'eliminazione" },
      { status: 500 }
    );
  }
}
