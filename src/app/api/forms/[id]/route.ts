import { NextRequest, NextResponse } from "next/server";
import { getForm, updateForm, deleteForm } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { FormStatus } from "@/lib/capture/types";

const STATUSES: FormStatus[] = ["draft", "active", "archived"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
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
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const existing = await getForm(id);
  if (!existing) {
    return NextResponse.json({ error: "Form non trovato" }, { status: 404 });
  }

  const data: Parameters<typeof updateForm>[1] = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description || null;
  if (typeof body.fields === "string") data.fields = body.fields;
  if (typeof body.style === "string") data.style = body.style;
  if (typeof body.successMessage === "string") data.successMessage = body.successMessage;
  if (body.redirectUrl !== undefined) data.redirectUrl = body.redirectUrl || null;
  if (typeof body.embedEnabled === "boolean") data.embedEnabled = body.embedEnabled;

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }
    data.status = body.status;
  }

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
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
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
