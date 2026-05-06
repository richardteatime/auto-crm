import { NextRequest, NextResponse } from "next/server";
import { listContacts, createContact } from "@/lib/db";
import { isValidEmail } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const temperature = searchParams.get("temperature") || undefined;
  const source = searchParams.get("source") || undefined;

  try {
    const results = await listContacts({ search, temperature, source });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero dei contatti" },
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

  const { name, email, phone, company, vatNumber, address, source, temperature, notes } =
    body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Il nome è obbligatorio" },
      { status: 400 }
    );
  }

  if (email && !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Formato email non valido" },
      { status: 400 }
    );
  }

  try {
    const result = await createContact({
      name: name.trim(),
      email: email || null,
      phone: phone || null,
      company: company || null,
      vatNumber: vatNumber || null,
      address: address || null,
      source: source || "otro",
      temperature: temperature || "cold",
      notes: notes || null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione del contatto" },
      { status: 500 }
    );
  }
}
