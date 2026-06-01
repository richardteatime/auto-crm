import { NextRequest, NextResponse } from "next/server";
import {
  getBookingLink,
  updateBookingLink,
  deleteBookingLink,
} from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { BookingLinkStatus } from "@/lib/capture/types";

const STATUSES: BookingLinkStatus[] = ["active", "paused", "archived"];

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

  const existing = await getBookingLink(id);
  if (!existing) {
    return NextResponse.json({ error: "Link non trovato" }, { status: 404 });
  }

  const data: Parameters<typeof updateBookingLink>[1] = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.assignedTo === "string") data.assignedTo = body.assignedTo.trim();
  if (typeof body.durationMinutes === "number" && body.durationMinutes > 0) {
    data.durationMinutes = Math.round(body.durationMinutes);
  }
  if (typeof body.availability === "string") data.availability = body.availability;
  if (typeof body.successMessage === "string") data.successMessage = body.successMessage;
  if (body.redirectUrl !== undefined) {
    data.redirectUrl = body.redirectUrl ? String(body.redirectUrl) : null;
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }
    data.status = body.status;
  }

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
