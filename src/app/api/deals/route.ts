import { NextRequest, NextResponse } from "next/server";
import { listDeals, createDeal, getStages } from "@/lib/db";

export async function GET() {
  try {
    const results = await listDeals();
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nel recupero delle trattative: ${error instanceof Error ? error.message : "sconosciuto"}` },
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

  const { title, value, stageId, contactId, expectedClose, probability, notes, attachments, isRecurring, recurringMonths } = body;

  if (!title || !contactId) {
    return NextResponse.json(
      { error: "Titolo e contatto sono obbligatori" },
      { status: 400 }
    );
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
      title,
      value: value || 0,
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    if (msg.includes("not found") || msg.includes("NOT_FOUND")) {
      return NextResponse.json(
        { error: "Contatto non trovato" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: `Errore nella creazione della trattativa: ${msg}` },
      { status: 500 }
    );
  }
}
