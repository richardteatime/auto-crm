import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateExpense, deleteExpense } from "@/lib/db/expenses";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  type: z.string().optional(),
  category: z.string().optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  date: z.string().datetime().optional(),
  createdBy: z.string().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { id } = await params;
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

  try {
    const update: Record<string, unknown> = {};
    if (parsed.data.type        !== undefined) update.type        = parsed.data.type;
    if (parsed.data.category    !== undefined) update.category    = parsed.data.category;
    if (parsed.data.description !== undefined) update.description = parsed.data.description;
    if (parsed.data.amount      !== undefined) update.amount      = Math.round(parsed.data.amount * 100);
    if (parsed.data.date        !== undefined) update.date        = new Date(parsed.data.date);
    if (parsed.data.createdBy   !== undefined) update.createdBy   = parsed.data.createdBy;

    const result = await updateExpense(id, update);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Spesa non trovata" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(_req);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    await deleteExpense(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Spesa non trovata" }, { status: 404 });
  }
}
