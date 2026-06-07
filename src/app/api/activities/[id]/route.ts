import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActivity, updateActivity, deleteActivity } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notifyAssignment } from "@/lib/notify";

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return msg.includes("404") || msg.includes("not found") || msg.includes("NOT_FOUND");
}

const BodySchema = z.object({
  completedAt: z.union([z.string().datetime(), z.boolean(), z.null()]).optional(),
  description: z.string().min(1).optional(),
  scheduledAt: z.union([z.string().datetime(), z.null()]).optional(),
  type: z.string().optional(),
  contactId: z.string().optional(),
  dealId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  startAt: z.union([z.string().datetime(), z.null()]).optional(),
  endAt: z.union([z.string().datetime(), z.null()]).optional(),
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
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};

  if (parsed.data.completedAt !== undefined) {
    if (parsed.data.completedAt === null || parsed.data.completedAt === true) {
      updateData.completedAt = new Date();
      updateData.isCompleted = true;
    } else if (typeof parsed.data.completedAt === "string") {
      const parsedDate = new Date(parsed.data.completedAt);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: "completedAt deve essere una data valida" },
          { status: 400 }
        );
      }
      updateData.completedAt = parsedDate;
      updateData.isCompleted = true;
    }
  }

  if (parsed.data.description !== undefined) {
    updateData.description = parsed.data.description;
  }

  if (parsed.data.scheduledAt !== undefined) {
    if (parsed.data.scheduledAt === null) {
      updateData.scheduledAt = null;
    } else {
      const parsedDate = new Date(parsed.data.scheduledAt);
      if (!isNaN(parsedDate.getTime())) updateData.scheduledAt = parsedDate;
    }
  }

  if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
  if (parsed.data.contactId !== undefined) updateData.contactId = parsed.data.contactId;
  if (parsed.data.dealId !== undefined) updateData.dealId = parsed.data.dealId ?? null;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes ?? null;
  if (parsed.data.attachments !== undefined) updateData.attachments = parsed.data.attachments ?? null;
  if (parsed.data.assignedTo !== undefined) updateData.assignedTo = parsed.data.assignedTo ?? null;

  if (parsed.data.startAt !== undefined) {
    updateData.startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : null;
  }
  if (parsed.data.endAt !== undefined) {
    updateData.endAt = parsed.data.endAt ? new Date(parsed.data.endAt) : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "Nessun campo da aggiornare" },
      { status: 400 }
    );
  }

  // Fetch current state to detect assignedTo changes
  let previousAssignedTo: string | null = null;
  if (body.assignedTo !== undefined) {
    const current = await getActivity(id);
    previousAssignedTo = current?.assignedTo ?? null;
  }

  try {
    const result = await updateActivity(id, updateData);

    // Notify only if assignedTo actually changed to a new (non-null) user
    const newAssignedTo = body.assignedTo ?? null;
    if (
      newAssignedTo &&
      newAssignedTo !== previousAssignedTo
    ) {
      await notifyAssignment({
        assignedToUserId: newAssignedTo,
        fromUserId: auth.user.id,
        fromUserName: auth.user.name || auth.user.email,
        type: "activity_assigned",
        title: `Attività assegnata: ${result.description}`,
        body: `Assegnata da ${auth.user.name || auth.user.email}`,
        relatedId: id,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(
        { error: "Attività non trovata" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Errore nell'aggiornamento" },
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
    await deleteActivity(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(
        { error: "Attività non trovata" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Errore nell'eliminazione" },
      { status: 500 }
    );
  }
}
