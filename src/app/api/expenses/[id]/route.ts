import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateExpense, deleteExpense } from "@/lib/db/expenses";
import { requireOwnerOrAdmin } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/appwrite";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  type: z.string().optional(),
  category: z.string().optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  date: z.string().datetime().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(req, COLLECTIONS.expenses, id);
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

  try {
    const update: Record<string, unknown> = {};
    if (parsed.data.type        !== undefined) update.type        = parsed.data.type;
    if (parsed.data.category    !== undefined) update.category    = parsed.data.category;
    if (parsed.data.description !== undefined) update.description = parsed.data.description;
    if (parsed.data.amount      !== undefined) update.amount      = Math.round(parsed.data.amount * 100);
    if (parsed.data.date        !== undefined) update.date        = new Date(parsed.data.date);

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
    }

    const result = await updateExpense(id, update);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message.toLowerCase().includes("not found")) {
      return NextResponse.json({ error: "Spesa non trovata" }, { status: 404 });
    }
    console.error("[expenses] Update failed:", e);
    return NextResponse.json({ error: "Errore durante l'aggiornamento" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(_req, COLLECTIONS.expenses, id);
  if (auth.error) return auth.error;

  try {
    await deleteExpense(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message.toLowerCase().includes("not found")) {
      return NextResponse.json({ error: "Spesa non trovata" }, { status: 404 });
    }
    console.error("[expenses] Delete failed:", e);
    return NextResponse.json({ error: "Errore durante l'eliminazione" }, { status: 500 });
  }
}
