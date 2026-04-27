import { NextRequest, NextResponse } from "next/server";
import { getDeal } from "@/lib/db/deals";
import { listQuotes, createQuote } from "@/lib/db/quotes";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await listQuotes({ dealId: id });
  return NextResponse.json(result);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const deal = await getDeal(id);
  if (!deal) {
    return NextResponse.json({ error: "Trattativa non trovata" }, { status: 404 });
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
    notes?: string;
    status?: string;
    vatRate?: number;
    validUntil?: string | null;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Il titolo è obbligatorio" }, { status: 400 });
  }

  try {
    const quote = await createQuote({
      dealId: id,
      title: title.trim(),
      items: items ? JSON.stringify(items) : "[]",
      notes: typeof notes === "string" ? notes.trim() : undefined,
      vatRate: typeof vatRate === "number" ? vatRate : 22,
      validUntil: typeof validUntil === "string" && validUntil ? new Date(validUntil) : undefined,
    });

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error creating quote:", msg, error);
    return NextResponse.json({ error: msg || "Errore durante la creazione del preventivo" }, { status: 500 });
  }
}
