import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getTask, updateTask, deleteTask,
  getCallTask, updateCallTask, deleteCallTask,
  getLead,
} from "@/lib/db";
import { requireAuth, requireOwnerOrAdmin, isAdmin, type AuthUser } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/appwrite";
import type { Task } from "@/types";

const BodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  done: z.boolean().optional(),
  dueAt: z.string().datetime().optional(),
});

function mapCallTaskToTask(
  callTask: {
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
  },
  leadName?: string | null,
): Task {
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

async function canModifyCallTask(callTask: { assignedTo: string }, user: AuthUser): Promise<boolean> {
  const setterId = process.env.CUGINA_USER_ID || "cugina";
  const closerId = process.env.LEO_USER_ID || "leo";

  let assigneeEmail: string | null = null;
  if (callTask.assignedTo === setterId) assigneeEmail = process.env.CUGINA_EMAIL || null;
  else if (callTask.assignedTo === closerId) assigneeEmail = process.env.LEO_EMAIL || null;

  if (assigneeEmail && assigneeEmail.toLowerCase() === user.email.toLowerCase()) {
    return true;
  }
  return isAdmin(user.id);
}

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
    // 1) Prova come task generico
    const existing = await getTask(id);
    if (existing) {
      const ownerCheck = await requireOwnerOrAdmin(request, COLLECTIONS.tasks, id);
      if (ownerCheck.error) return ownerCheck.error;
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
    }

    // 2) Prova come call task
    const callTask = await getCallTask(id);
    if (callTask) {
      if (!(await canModifyCallTask(callTask, auth.user))) {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
      }
      // Per i call task permettiamo solo il toggle done che mappa su status
      if (parsed.data.done !== undefined) {
        const newStatus = parsed.data.done ? "completed" : "pending";
        await updateCallTask(id, { status: newStatus });
      }
      const refreshed = await getCallTask(id);
      if (!refreshed) {
        return NextResponse.json({ error: "Call task non trovato dopo aggiornamento" }, { status: 404 });
      }
      const lead = await getLead(refreshed.leadId);
      return NextResponse.json(mapCallTaskToTask(refreshed as unknown as {
        id: string; leadId: string; assignedTo: string; assigneeName: string | null;
        status: string; scheduledAt: string | null; completedAt: string | null;
        callOutcome: string | null; notes: string | null; createdAt: Date; updatedAt: Date;
      }, lead?.fullName));
    }

    return NextResponse.json({ error: "Task non trovato" }, { status: 404 });
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
    if (existing) {
      const ownerCheck = await requireOwnerOrAdmin(_request, COLLECTIONS.tasks, id);
      if (ownerCheck.error) return ownerCheck.error;
      await deleteTask(id);
      return NextResponse.json({ success: true });
    }

    const callTask = await getCallTask(id);
    if (callTask) {
      if (!(await canModifyCallTask(callTask, auth.user))) {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
      }
      await deleteCallTask(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Task non trovato" }, { status: 404 });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'eliminazione del task" },
      { status: 500 }
    );
  }
}
