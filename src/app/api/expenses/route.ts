import { NextRequest, NextResponse } from "next/server";
import { listExpenses, createExpense } from "@/lib/db/expenses";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  try {
    const result = await listExpenses({
      startDate: start ? new Date(start) : undefined,
      endDate: end ? new Date(end) : undefined,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Errore nel caricamento spese" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const { type, category, description, amount, date, createdBy } = body;
  if (!description || !amount || !date) {
    return NextResponse.json({ error: "Descrizione, importo e data sono obbligatori" }, { status: 400 });
  }

  const result = await createExpense({
    type: type || "spesa",
    category: category || "Altro",
    description,
    amount: Math.round(parseFloat(amount) * 100),
    date: new Date(date),
    createdBy: createdBy || "Team",
  });

  return NextResponse.json(result, { status: 201 });
}
