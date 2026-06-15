import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getForm, updateForm, deleteForm } from "@/lib/db";
import { requireOwnerOrAdmin } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/appwrite";

const BodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  fields: z.string().optional(),
  style: z.string().optional(),
  successMessage: z.string().optional(),
  redirectUrl: z.string().nullable().optional(),
  embedEnabled: z.boolean().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(request, COLLECTIONS.forms, id);
  if (auth.error) return auth.error;

  const form = await getForm(id);
  if (!form) {
    return NextResponse.json({ error: "Form non trovato" }, { status: 404 });
  }
  return NextResponse.json(form);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(request, COLLECTIONS.forms, id);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await getForm(id);
  if (!existing) {
    return NextResponse.json({ error: "Form non trovato" }, { status: 404 });
  }

  const data: Parameters<typeof updateForm>[1] = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.fields !== undefined) data.fields = parsed.data.fields;
  if (parsed.data.style !== undefined) data.style = parsed.data.style;
  if (parsed.data.successMessage !== undefined) data.successMessage = parsed.data.successMessage;
  if (parsed.data.redirectUrl !== undefined) data.redirectUrl = parsed.data.redirectUrl;
  if (parsed.data.embedEnabled !== undefined) data.embedEnabled = parsed.data.embedEnabled;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;

  try {
    const updated = await updateForm(id, data);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Errore nell'aggiornamento del form" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(request, COLLECTIONS.forms, id);
  if (auth.error) return auth.error;

  const existing = await getForm(id);
  if (!existing) {
    return NextResponse.json({ error: "Form non trovato" }, { status: 404 });
  }

  try {
    await deleteForm(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Errore nell'eliminazione del form" }, { status: 500 });
  }
}
