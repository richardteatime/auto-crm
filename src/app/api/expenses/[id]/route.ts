import { NextRequest, NextResponse } from "next/server";
import { updateExpense, deleteExpense } from "@/lib/db/expenses";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  try {
    const update: Record<string, unknown> = {};
    if (body.type        !== undefined) update.type        = body.type;
    if (body.category    !== undefined) update.category    = body.category;
    if (body.description !== undefined) update.description = body.description;
    if (body.amount      !== undefined) update.amount      = Math.round(parseFloat(body.amount) * 100);
    if (body.date        !== undefined) update.date        = new Date(body.date);
    if (body.createdBy   !== undefined) update.createdBy   = body.createdBy;

    const result = await updateExpense(id, update);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Spesa non trovata" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteExpense(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Spesa non trovata" }, { status: 404 });
  }
}
