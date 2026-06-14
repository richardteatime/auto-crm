import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listExpenses, createExpense } from "@/lib/db/expenses";
import { requireFinanceOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

const BodySchema = z.object({
  type: z.string().optional(),
  category: z.string().optional(),
  description: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().datetime(),
});

export async function GET(req: NextRequest) {
  const auth = await requireFinanceOrAdmin(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsedQuery = QuerySchema.safeParse(queryObj);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Parametri non validi", issues: parsedQuery.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await listExpenses({
      startDate: parsedQuery.data.start ? new Date(parsedQuery.data.start) : undefined,
      endDate: parsedQuery.data.end ? new Date(parsedQuery.data.end) : undefined,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Errore nel caricamento spese" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireFinanceOrAdmin(req);
  if (auth.error) return auth.error;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const result = await createExpense({
    type: parsed.data.type || "spesa",
    category: parsed.data.category || "Altro",
    description: parsed.data.description,
    amount: Math.round(parsed.data.amount * 100),
    date: new Date(parsed.data.date),
    createdBy: auth.user.id,
  });

  return NextResponse.json(result, { status: 201 });
}
