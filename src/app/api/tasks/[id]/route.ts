import { NextRequest, NextResponse } from "next/server";
import { updateTask, deleteTask } from "@/lib/db/tasks";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo.trim();
    if (body.done !== undefined) updates.done = body.done;
    if (body.dueAt !== undefined) updates.dueAt = body.dueAt ? new Date(body.dueAt) : null;

    const updated = await updateTask(id, updates);

    if (!updated) {
      return NextResponse.json({ error: "Task non trovato" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Errore nell'aggiornamento del task" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Errore nell'eliminazione del task" }, { status: 500 });
  }
}
