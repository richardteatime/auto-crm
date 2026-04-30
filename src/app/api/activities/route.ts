import { NextRequest, NextResponse } from "next/server";
import { listActivities, createActivity } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId") || undefined;
  const dealId = searchParams.get("dealId") || undefined;

  try {
    const results = await listActivities({ contactId, dealId });
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nel recupero delle attività: ${error instanceof Error ? error.message : "sconosciuto"}` },
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

  const { type, description, contactId, dealId, scheduledAt, startAt, endAt, notes, attachments } = body;

  if (!type || !description || !contactId) {
    return NextResponse.json(
      { error: "Tipo, descrizione e contatto sono obbligatori" },
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
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    return NextResponse.json(
      { error: `Errore nella creazione dell'attività: ${msg}` },
      { status: 500 }
    );
  }
}
