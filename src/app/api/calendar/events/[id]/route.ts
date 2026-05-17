import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/db/calendar";
import { requireAuth } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const event = await getCalendarEvent(id);
  if (!event) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const body = await request.json();
    const assignedTo: string[] | undefined = body.assignedTo !== undefined
      ? (Array.isArray(body.assignedTo) ? body.assignedTo : [])
      : undefined;
    const event = await updateCalendarEvent(
      id,
      assignedTo !== undefined ? { ...body, assignedTo } : body,
    );
    return NextResponse.json(event);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    await deleteCalendarEvent(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
