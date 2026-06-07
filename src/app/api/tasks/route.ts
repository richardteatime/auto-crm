import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listTasks, createTask } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const QuerySchema = z.object({
  assignedTo: z.string().optional(),
  done: z.enum(["true", "false"]).optional(),
});

const BodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  assignedTo: z.string().optional(),
  dueAt: z.string().datetime().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsedQuery = QuerySchema.safeParse(queryObj);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Parametri non validi", issues: parsedQuery.error.issues },
      { status: 400 }
    );
  }

  const done = parsedQuery.data.done === "true" ? true : parsedQuery.data.done === "false" ? false : undefined;

  try {
    const results = await listTasks({ assignedTo: parsedQuery.data.assignedTo, done });
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await createTask({
      title: parsed.data.title.trim(),
      description: parsed.data.description ?? null,
      assignedTo: parsed.data.assignedTo || "orchestrator",
      dueAt: parsed.data.dueAt ?? null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione del task" },
      { status: 500 }
    );
  }
}
