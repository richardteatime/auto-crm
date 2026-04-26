import { NextRequest, NextResponse } from "next/server";
import { listContacts, createContact } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const temperature = searchParams.get("temperature") || undefined;
  const source = searchParams.get("source") || undefined;

  try {
    const results = await listContacts({ search, temperature, source });
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nel recupero dei contatti: ${error instanceof Error ? error.message : "sconosciuto"}` },
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

  const { name, email, phone, company, source, temperature, score, notes } =
    body;

  if (!name) {
    return NextResponse.json(
      { error: "Il nome è obbligatorio" },
      { status: 400 }
    );
  }

  try {
    const result = await createContact({
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      source: source || "otro",
      temperature: temperature || "cold",
      score: score || 0,
      notes: notes || null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nella creazione del contatto: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}
