import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getContactWithRelations,
  getContact,
  updateContact,
  deleteContact,
} from "@/lib/db";
import { requireAuth, requireOwnerOrAdmin } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/appwrite";

const BodySchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  source: z.string().optional(),
  temperature: z.string().optional(),
  notes: z.string().optional().nullable(),
});

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
  const { id } = await params;

  const auth = await requireOwnerOrAdmin(request, COLLECTIONS.contacts, id);
  if (auth.error) return auth.error;

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

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email || null;
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
    if (parsed.data.company !== undefined) updateData.company = parsed.data.company;
    if (parsed.data.vatNumber !== undefined) updateData.vatNumber = parsed.data.vatNumber;
    if (parsed.data.address !== undefined) updateData.address = parsed.data.address;
    if (parsed.data.source !== undefined) updateData.source = parsed.data.source;
    if (parsed.data.temperature !== undefined) updateData.temperature = parsed.data.temperature;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

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
  const { id } = await params;

  const auth = await requireOwnerOrAdmin(_request, COLLECTIONS.contacts, id);
  if (auth.error) return auth.error;

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
