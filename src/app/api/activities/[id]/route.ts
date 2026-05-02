import { NextRequest, NextResponse } from "next/server";
import { updateActivity, deleteActivity } from "@/lib/db";

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return msg.includes("404") || msg.includes("not found") || msg.includes("NOT_FOUND");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.completedAt !== undefined) {
    if (body.completedAt === null || body.completedAt === true) {
      updateData.completedAt = new Date();
      updateData.isCompleted = true;
    } else if (typeof body.completedAt === "string") {
      const parsed = new Date(body.completedAt);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "completedAt deve essere una data valida" },
          { status: 400 }
        );
      }
      updateData.completedAt = parsed;
      updateData.isCompleted = true;
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== "string" || !body.description.trim()) {
      return NextResponse.json(
        { error: "description deve essere un testo non vuoto" },
        { status: 400 }
      );
    }
    updateData.description = body.description;
  }

  if (body.scheduledAt !== undefined) {
    if (body.scheduledAt === null) {
      updateData.scheduledAt = null;
    } else if (typeof body.scheduledAt === "string") {
      const parsed = new Date(body.scheduledAt);
      if (!isNaN(parsed.getTime())) updateData.scheduledAt = parsed;
    }
  }

  if (body.type !== undefined) updateData.type = body.type;
  if (body.contactId !== undefined) updateData.contactId = body.contactId;
  if (body.dealId !== undefined) updateData.dealId = body.dealId ?? null;
  if (body.notes !== undefined) updateData.notes = body.notes ?? null;
  if (body.attachments !== undefined) updateData.attachments = body.attachments ?? null;

  if (body.startAt !== undefined) {
    updateData.startAt = body.startAt ? new Date(body.startAt) : null;
  }
  if (body.endAt !== undefined) {
    updateData.endAt = body.endAt ? new Date(body.endAt) : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "Nessun campo da aggiornare" },
      { status: 400 }
    );
  }

  try {
    const result = await updateActivity(id, updateData);
    return NextResponse.json(result);
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(
        { error: "Attività non trovata" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: `Errore nell'aggiornamento: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      { error: `Errore nell'eliminazione: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}
