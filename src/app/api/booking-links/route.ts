import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listBookingLinks, createBookingLink } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const BodySchema = z.object({
  name: z.string().min(1),
  assignedTo: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
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
  const auth = await requireAdmin(request);
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

  const assignedTo = parsed.data.assignedTo?.trim() || auth.user.id;

  try {
    const link = await createBookingLink({
      name: parsed.data.name.trim(),
      assignedTo,
      durationMinutes: parsed.data.durationMinutes,
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
