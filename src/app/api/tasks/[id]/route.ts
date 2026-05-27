import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask, deleteTask } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  try {
    const existing = await getTask(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Task non trovato" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo;
    if (body.done !== undefined) updateData.done = body.done;
    if (body.dueAt !== undefined) updateData.dueAt = body.dueAt;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existing);
    }

    const result = await updateTask(id, updateData);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento del task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(_request);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const existing = await getTask(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Task non trovato" },
        { status: 404 }
      );
    }

    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'eliminazione del task" },
      { status: 500 }
    );
  }
}
