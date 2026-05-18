import { NextRequest, NextResponse } from "next/server";
import { listCalendarEvents, createCalendarEvent } from "@/lib/db/calendar";
import { requireAuth } from "@/lib/auth";
import { notifyAssignment } from "@/lib/notify";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  try {
    const events = await listCalendarEvents({
      startAfter: start ? new Date(start) : undefined,
      endBefore: end ? new Date(end) : undefined,
    });
    return NextResponse.json(events);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Titolo obbligatorio" }, { status: 400 });
    }
    if (!body.startAt) {
      return NextResponse.json({ error: "Data inizio obbligatoria" }, { status: 400 });
    }
    if (!body.endAt) {
      return NextResponse.json({ error: "Data fine obbligatoria" }, { status: 400 });
    }

    const assignedTo: string[] = Array.isArray(body.assignedTo) ? body.assignedTo : [];

    const event = await createCalendarEvent({
      title: body.title.trim(),
      description: body.description ?? null,
      startAt: body.startAt,
      endAt: body.endAt,
      allDay: body.allDay ?? false,
      type: body.type ?? "activity",
      assignedTo,
      createdBy: auth.user.id,
      contactId: body.contactId ?? null,
      dealId: body.dealId ?? null,
      projectId: body.projectId ?? null,
      location: body.location ?? null,
      color: body.color ?? null,
      isPrivate: body.isPrivate ?? false,
    });

    for (const userId of assignedTo) {
      await notifyAssignment({
        assignedToUserId: userId,
        fromUserId: auth.user.id,
        fromUserName: auth.user.name || auth.user.email,
        type: "calendar_assigned",
        title: `Nuovo evento calendar assegnato: ${body.title}`,
        body: `Assegnato da ${auth.user.name || auth.user.email}`,
        relatedId: event.id,
      });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
