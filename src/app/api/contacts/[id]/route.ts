import { NextRequest, NextResponse } from "next/server";
import {
  getContactWithRelations,
  getContact,
  updateContact,
  deleteContact,
} from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const contact = await getContactWithRelations(id);

    if (!contact) {
      return NextResponse.json(
        { error: "Contatto non trovato" },
        { status: 404 }
      );
    }

    return NextResponse.json(contact);
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nel recupero del contatto: ${error instanceof Error ? error.message : "sconosciuto"}` },
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
    const existing = await getContact(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Contatto non trovato" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.temperature !== undefined) updateData.temperature = body.temperature;
    if (body.score !== undefined) updateData.score = Math.max(0, Math.min(100, body.score));
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existing);
    }

    const result = await updateContact(id, updateData);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nell'aggiornamento del contatto: ${error instanceof Error ? error.message : "sconosciuto"}` },
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
    const existing = await getContact(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Contatto non trovato" },
        { status: 404 }
      );
    }

    await deleteContact(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nell'eliminazione del contatto: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}
