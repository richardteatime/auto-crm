import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listCalendarEvents, createCalendarEvent } from "@/lib/db/calendar";
import { requireAuth } from "@/lib/auth";
import { notifyAssignment } from "@/lib/notify";

const QuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

const BodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().optional(),
  type: z.enum(["activity", "meeting", "call", "travel", "out_of_office", "personal", "other"]).optional(),
  assignedTo: z.array(z.string()).optional(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  isPrivate: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsedQuery = QuerySchema.safeParse(queryObj);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Parametri non validi", issues: parsedQuery.error.issues },
      { status: 400 }
    );
  }

  try {
    const events = await listCalendarEvents({
      startAfter: parsedQuery.data.start ? new Date(parsedQuery.data.start) : undefined,
      endBefore: parsedQuery.data.end ? new Date(parsedQuery.data.end) : undefined,
    });
    return NextResponse.json(events);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const assignedTo: string[] = parsed.data.assignedTo ?? [];

    const event = await createCalendarEvent({
      title: parsed.data.title.trim(),
      description: parsed.data.description ?? null,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      allDay: parsed.data.allDay ?? false,
      type: parsed.data.type ?? "activity",
      assignedTo,
      createdBy: auth.user.id,
      contactId: parsed.data.contactId ?? null,
      dealId: parsed.data.dealId ?? null,
      projectId: parsed.data.projectId ?? null,
      location: parsed.data.location ?? null,
      color: parsed.data.color ?? null,
      isPrivate: parsed.data.isPrivate ?? false,
    });

    for (const userId of assignedTo) {
      await notifyAssignment({
        assignedToUserId: userId,
        fromUserId: auth.user.id,
        fromUserName: auth.user.name || auth.user.email,
        type: "calendar_assigned",
        title: `Nuovo evento calendar assegnato: ${parsed.data.title}`,
        body: `Assegnato da ${auth.user.name || auth.user.email}`,
        relatedId: event.id,
      });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
