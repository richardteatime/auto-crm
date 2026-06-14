import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQuote, updateQuote, deleteQuote } from "@/lib/db/quotes";
import { requireAuth, requireOwnerOrAdmin } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/appwrite";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  title: z.string().min(1).optional(),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  notes: z.string().optional().nullable(),
  status: z.string().optional(),
  vatRate: z.number().optional(),
  validUntil: z.string().datetime().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(_req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) {
    return NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 });
  }
  return NextResponse.json(quote);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(request, COLLECTIONS.quotes, id);
  if (auth.error) return auth.error;
  const quote = await getQuote(id);
  if (!quote) {
    return NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
  if (parsed.data.items !== undefined) updates.items = JSON.stringify(parsed.data.items);
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes?.trim() || null;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.vatRate !== undefined) updates.vatRate = parsed.data.vatRate;
  if (parsed.data.validUntil !== undefined) updates.validUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil) : null;

  const updated = await updateQuote(id, updates);

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(_req, COLLECTIONS.quotes, id);
  if (auth.error) return auth.error;
  const quote = await getQuote(id);
  if (!quote) {
    return NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 });
  }
  await deleteQuote(id);
  return NextResponse.json({ success: true });
}
