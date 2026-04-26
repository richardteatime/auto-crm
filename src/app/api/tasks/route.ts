import { NextRequest, NextResponse } from "next/server";
import { listTasks, createTask } from "@/lib/db/tasks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await listTasks();
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Errore nel caricamento task" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, description, assignedTo, createdBy, dueAt } = await req.json();

    if (!title?.trim() || !assignedTo?.trim() || !createdBy?.trim()) {
      return NextResponse.json(
        { error: "Titolo, assegnato a e creato da sono obbligatori" },
        { status: 400 }
      );
    }

    const task = await createTask({
      title: title.trim(),
      description: description?.trim() || null,
      assignedTo: assignedTo.trim(),
      createdBy: createdBy.trim(),
      dueAt: dueAt ? new Date(dueAt) : null,
    });

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore nella creazione del task" }, { status: 500 });
  }
}
