import { NextRequest, NextResponse } from "next/server";
import { listDeals, createDeal, getStages } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const results = await listDeals();
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero delle trattative" },
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

  const { title, value, stageId, contactId, expectedClose, probability, notes, attachments, isRecurring, recurringMonths } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "Titolo obbligatorio" },
      { status: 400 }
    );
  }

  if (!contactId || typeof contactId !== "string") {
    return NextResponse.json(
      { error: "Contatto obbligatorio" },
      { status: 400 }
    );
  }

  if (expectedClose) {
    const d = new Date(expectedClose);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "Data di chiusura attesa non valida" },
        { status: 400 }
      );
    }
  }

  // Get first stage if none provided
  let finalStageId = stageId;
  if (!finalStageId) {
    const stages = await getStages();
    finalStageId = stages[0]?.id;
  }

  if (!finalStageId) {
    return NextResponse.json(
      { error: "Nessuna fase del pipeline configurata" },
      { status: 400 }
    );
  }

  try {
    const result = await createDeal({
      title: title.trim(),
      value: Number(value) || 0,
      stageId: finalStageId,
      contactId,
      expectedClose: expectedClose ? new Date(expectedClose) : null,
      probability: Math.max(0, Math.min(100, Number(probability) || 0)),
      notes: notes || null,
      attachments: attachments ? JSON.stringify(attachments) : "[]",
      isRecurring: !!isRecurring,
      recurringMonths: isRecurring ? (Number(recurringMonths) || 12) : null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione della trattativa" },
      { status: 500 }
    );
  }
}
