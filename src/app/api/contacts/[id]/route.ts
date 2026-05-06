import { NextRequest, NextResponse } from "next/server";
import {
  getContactWithRelations,
  getContact,
  updateContact,
  deleteContact,
} from "@/lib/db";
import { isValidEmail } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(_request);
  if (auth.error) return auth.error;

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
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero del contatto" },
      { status: 500 }
    );
  }
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

  try {
    const existing = await getContact(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Contatto non trovato" },
        { status: 404 }
      );
    }

    if (body.email && !isValidEmail(body.email)) {
      return NextResponse.json(
        { error: "Formato email non valido" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.vatNumber !== undefined) updateData.vatNumber = body.vatNumber;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.temperature !== undefined) updateData.temperature = body.temperature;
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existing);
    }

    const result = await updateContact(id, updateData);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento del contatto" },
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
    const existing = await getContact(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Contatto non trovato" },
        { status: 404 }
      );
    }

    await deleteContact(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'eliminazione del contatto" },
      { status: 500 }
    );
  }
}
