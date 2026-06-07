import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDeal } from "@/lib/db/deals";
import { listQuotes, createQuote } from "@/lib/db/quotes";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  title: z.string().min(1),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  notes: z.string().optional().nullable(),
  vatRate: z.number().optional(),
  validUntil: z.string().datetime().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(_req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const result = await listQuotes({ dealId: id });
  return NextResponse.json(result);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const quote = await createQuote({
      dealId: id,
      title: parsed.data.title.trim(),
      items: parsed.data.items ? JSON.stringify(parsed.data.items) : "[]",
      notes: parsed.data.notes?.trim() ?? undefined,
      vatRate: parsed.data.vatRate ?? 22,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
    });

    return NextResponse.json(quote, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione del preventivo" }, { status: 500 });
  }
}
