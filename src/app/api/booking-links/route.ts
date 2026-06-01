import { NextRequest, NextResponse } from "next/server";
import { listBookingLinks, createBookingLink } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const links = await listBookingLinks();
    return NextResponse.json(links);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero dei link di prenotazione" },
      { status: 500 },
    );
  }
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
    return NextResponse.json({ error: "Il nome è obbligatorio" }, { status: 400 });
  }

  const assignedTo =
    typeof body.assignedTo === "string" && body.assignedTo.trim()
      ? body.assignedTo.trim()
      : auth.user.id;

  try {
    const link = await createBookingLink({
      name,
      assignedTo,
      durationMinutes:
        typeof body.durationMinutes === "number" ? body.durationMinutes : undefined,
      createdBy: auth.user.id,
    });
    return NextResponse.json(link, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione del link di prenotazione" },
      { status: 500 },
    );
  }
}
