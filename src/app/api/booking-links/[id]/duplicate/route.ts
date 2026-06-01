import { NextRequest, NextResponse } from "next/server";
import { createBookingLink, getBookingLink, updateBookingLink } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const source = await getBookingLink(id);
  if (!source) {
    return NextResponse.json({ error: "Link non trovato" }, { status: 404 });
  }

  try {
    const copy = await createBookingLink({
      name: `${source.name} (copia)`,
      assignedTo: source.assignedTo,
      durationMinutes: source.durationMinutes,
      availability: source.availability,
      successMessage: source.successMessage,
      createdBy: auth.user.id,
    });
    const updated = await updateBookingLink(copy.id, {
      redirectUrl: source.redirectUrl,
      status: source.status,
    });
    return NextResponse.json(updated, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore nella duplicazione" }, { status: 500 });
  }
}
