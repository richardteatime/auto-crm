import { NextRequest, NextResponse } from "next/server";
import { getDeal, updateDeal, deleteDeal } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const deal = await getDeal(id);

    if (!deal) {
      return NextResponse.json(
        { error: "Trattativa non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(deal);
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nel recupero della trattativa: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
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
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  try {
    const existing = await getDeal(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Trattativa non trovata" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.value !== undefined) updateData.value = body.value;
    if (body.stageId !== undefined) updateData.stageId = body.stageId;
    if (body.contactId !== undefined) updateData.contactId = body.contactId;
    if (body.expectedClose !== undefined) {
      updateData.expectedClose = body.expectedClose ? new Date(body.expectedClose) : null;
    }
    if (body.probability !== undefined) {
      updateData.probability = Math.max(0, Math.min(100, Number(body.probability)));
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.attachments !== undefined) updateData.attachments = JSON.stringify(body.attachments ?? []);
    if (body.isRecurring !== undefined) updateData.isRecurring = !!body.isRecurring;
    if (body.recurringMonths !== undefined) updateData.recurringMonths = Number(body.recurringMonths) || 12;
    if (body.isPaid !== undefined) updateData.isPaid = !!body.isPaid;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existing);
    }

    // updateDeal handles wonAt/recurringStartDate logic internally
    const result = await updateDeal(id, updateData);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nell'aggiornamento della trattativa: ${error instanceof Error ? error.message : "sconosciuto"}` },
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
    const existing = await getDeal(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Trattativa non trovata" },
        { status: 404 }
      );
    }

    await deleteDeal(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nell'eliminazione della trattativa: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}
