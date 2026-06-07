import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTask, updateTask, deleteTask } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  done: z.boolean().optional(),
  dueAt: z.string().datetime().optional(),
});

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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
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
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.assignedTo !== undefined) updateData.assignedTo = parsed.data.assignedTo;
    if (parsed.data.done !== undefined) updateData.done = parsed.data.done;
    if (parsed.data.dueAt !== undefined) updateData.dueAt = parsed.data.dueAt;

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
