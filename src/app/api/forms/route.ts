import { NextRequest, NextResponse } from "next/server";
import { listForms, createForm } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const forms = await listForms();
  return NextResponse.json(forms);
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
  }

  try {
    const form = await createForm({ name, createdBy: auth.user.id });
    return NextResponse.json(form, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore nella creazione del form" }, { status: 500 });
  }
}
