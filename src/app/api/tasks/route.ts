import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listTasks, createTask } from "@/lib/db";
import { listCallTasks, getLead } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { Task } from "@/types";

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

function mapCallTaskToTask(callTask: {
  id: string;
  leadId: string;
  assignedTo: string;
  assigneeName: string | null;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  callOutcome: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}, leadName?: string | null): Task {
  const title = leadName
    ? `Chiamata — ${leadName}`
    : `Chiamata lead ${callTask.leadId}`;
  return {
    id: callTask.id,
    title,
    description: callTask.notes,
    assignedTo: callTask.assignedTo,
    createdBy: callTask.assignedTo,
    done: callTask.status === "completed" || callTask.status === "failed" || callTask.status === "not_interested",
    dueAt: callTask.scheduledAt ? new Date(callTask.scheduledAt) : null,
    createdAt: callTask.createdAt,
    updatedAt: callTask.updatedAt,
    taskType: "call",
    leadId: callTask.leadId,
    callStatus: callTask.status,
    assigneeName: callTask.assigneeName,
  };
}

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
    const [genericTasks, callTasks] = await Promise.all([
      listTasks({ assignedTo: parsedQuery.data.assignedTo, done }),
      listCallTasks({ assignedTo: parsedQuery.data.assignedTo }),
    ]);

    // Per i call task, recuperiamo i nomi dei lead in batch per fare titoli leggibili
    const leadIds = [...new Set(callTasks.map((c) => c.leadId).filter(Boolean))];
    const leadMap = new Map<string, string>();
    await Promise.all(
      leadIds.map(async (leadId) => {
        const lead = await getLead(leadId);
        if (lead) leadMap.set(leadId, lead.fullName);
      })
    );

    const mappedCalls = callTasks.map((c) =>
      mapCallTaskToTask(c as unknown as {
        id: string;
        leadId: string;
        assignedTo: string;
        assigneeName: string | null;
        status: string;
        scheduledAt: string | null;
        completedAt: string | null;
        callOutcome: string | null;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
      }, leadMap.get(c.leadId))
    );

    const all = [...genericTasks.map((t) => ({ ...t, taskType: "generic" as const })), ...mappedCalls];
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json(all);
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
