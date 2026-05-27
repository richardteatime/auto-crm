import { NextRequest, NextResponse } from "next/server";
import { listTasks, createTask } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const assignedTo = searchParams.get("assignedTo") || undefined;
  const doneParam = searchParams.get("done");
  const done = doneParam === "true" ? true : doneParam === "false" ? false : undefined;

  try {
    const results = await listTasks({ assignedTo, done });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero dei task" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const { title, description, assignedTo, dueAt } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "Il titolo è obbligatorio" },
      { status: 400 }
    );
  }

  try {
    const result = await createTask({
      title: title.trim(),
      description: description || null,
      assignedTo: assignedTo || "orchestrator",
      dueAt: dueAt || null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione del task" },
      { status: 500 }
    );
  }
}
