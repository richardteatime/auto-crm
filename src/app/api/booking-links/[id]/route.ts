import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getBookingLink,
  updateBookingLink,
  deleteBookingLink,
} from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  name: z.string().min(1).optional(),
  assignedTo: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  availability: z.string().optional(),
  successMessage: z.string().optional(),
  redirectUrl: z.string().nullable().optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const link = await getBookingLink(id);
  if (!link) {
    return NextResponse.json({ error: "Link non trovato" }, { status: 404 });
  }
  return NextResponse.json(link);
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await getBookingLink(id);
  if (!existing) {
    return NextResponse.json({ error: "Link non trovato" }, { status: 404 });
  }

  const data: Parameters<typeof updateBookingLink>[1] = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.assignedTo !== undefined) data.assignedTo = parsed.data.assignedTo.trim();
  if (parsed.data.durationMinutes !== undefined) {
    data.durationMinutes = Math.round(parsed.data.durationMinutes);
  }
  if (parsed.data.availability !== undefined) data.availability = parsed.data.availability;
  if (parsed.data.successMessage !== undefined) data.successMessage = parsed.data.successMessage;
  if (parsed.data.redirectUrl !== undefined) {
    data.redirectUrl = parsed.data.redirectUrl;
  }
  if (parsed.data.status !== undefined) data.status = parsed.data.status;

  try {
    const updated = await updateBookingLink(id, data);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento del link" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const existing = await getBookingLink(id);
  if (!existing) {
    return NextResponse.json({ error: "Link non trovato" }, { status: 404 });
  }

  try {
    await deleteBookingLink(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'eliminazione del link" },
      { status: 500 },
    );
  }
}
