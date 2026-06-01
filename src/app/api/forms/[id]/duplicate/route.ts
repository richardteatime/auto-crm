import { NextRequest, NextResponse } from "next/server";
import { getForm, createForm } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const source = await getForm(id);
  if (!source) {
    return NextResponse.json({ error: "Form non trovato" }, { status: 404 });
  }

  try {
    const copy = await createForm({
      name: `${source.name} (copia)`,
      description: source.description,
      fields: source.fields,
      style: source.style,
      successMessage: source.successMessage,
      createdBy: auth.user.id,
    });
    return NextResponse.json(copy, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore nella duplicazione" }, { status: 500 });
  }
}
