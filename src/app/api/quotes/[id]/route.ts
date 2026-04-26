import { NextRequest, NextResponse } from "next/server";
import { getQuote, updateQuote, deleteQuote } from "@/lib/db/quotes";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { title, items, notes, status, vatRate, validUntil } = body as {
    title?: string;
    items?: unknown[];
    notes?: string | null;
    status?: string;
    vatRate?: number;
    validUntil?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title.trim();
  if (items !== undefined) updates.items = JSON.stringify(items);
  if (notes !== undefined) updates.notes = notes?.trim() || null;
  if (status !== undefined) updates.status = status;
  if (vatRate !== undefined) updates.vatRate = vatRate;
  if (validUntil !== undefined) updates.validUntil = validUntil ? new Date(validUntil) : null;

  const updated = await updateQuote(id, updates);

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) {
    return NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 });
  }
  await deleteQuote(id);
  return NextResponse.json({ success: true });
}
