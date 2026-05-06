import { NextRequest, NextResponse } from "next/server";
import { listActivities, createActivity } from "@/lib/db";
import { VALID_ACTIVITY_TYPES } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId") || undefined;
  const dealId = searchParams.get("dealId") || undefined;
  const assignedTo = searchParams.get("assignedTo") || undefined;

  try {
    const results = await listActivities({ contactId, dealId, assignedTo });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero delle attività" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const { type, description, contactId, dealId, scheduledAt, startAt, endAt, notes, attachments, assignedTo } = body;

  if (!type || !description || !contactId) {
    return NextResponse.json(
      { error: "Tipo, descrizione e contatto sono obbligatori" },
      { status: 400 }
    );
  }

  if (!VALID_ACTIVITY_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Tipo di attività non valido" },
      { status: 400 }
    );
  }

  try {
    const result = await createActivity({
      type,
      description,
      contactId,
      dealId: dealId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      startAt: startAt ? new Date(startAt) : null,
      endAt: endAt ? new Date(endAt) : null,
      notes: notes || null,
      attachments: attachments ? JSON.stringify(attachments) : null,
      completedAt: null,
      isCompleted: false,
      assignedTo: assignedTo || null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione dell'attività" },
      { status: 500 }
    );
  }
}
