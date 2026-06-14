import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/db/calendar";
import { requireAuth, isAdmin } from "@/lib/auth";
import { notifyAssignment } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

async function canAccessCalendarEvent(event: { createdBy: string; assignedTo: string[] }, userId: string): Promise<boolean> {
  if (event.createdBy === userId) return true;
  if (event.assignedTo.includes(userId)) return true;
  return isAdmin(userId);
}

const BodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  type: z.enum(["activity", "meeting", "call", "travel", "out_of_office", "personal", "other"]).optional(),
  assignedTo: z.array(z.string()).optional(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  isPrivate: z.boolean().optional(),
}).passthrough();

async function loadEventWithAuth(request: NextRequest, id: string) {
  const auth = await requireAuth(request);
  if (auth.error) return { error: auth.error };

  const event = await getCalendarEvent(id);
  if (!event) {
    return { error: NextResponse.json({ error: "Non trovato" }, { status: 404 }) };
  }
  if (!(await canAccessCalendarEvent(event, auth.user.id))) {
    return { error: NextResponse.json({ error: "Non autorizzato" }, { status: 403 }) };
  }
  return { user: auth.user, event };
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const check = await loadEventWithAuth(request, id);
  if (check.error) return check.error;
  return NextResponse.json(check.event);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const check = await loadEventWithAuth(request, id);
  if (check.error) return check.error;

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
    const assignedTo: string[] | undefined = parsed.data.assignedTo !== undefined
      ? parsed.data.assignedTo
      : undefined;
    // Detect assignedTo changes before updating
    let previousAssignedTo: string[] = [];
    if (assignedTo !== undefined) {
      const current = await getCalendarEvent(id);
      previousAssignedTo = current?.assignedTo ?? [];
    }

    const event = await updateCalendarEvent(
      id,
      assignedTo !== undefined ? { ...parsed.data, assignedTo } : parsed.data,
    );

    if (assignedTo !== undefined) {
      const newlyAssigned = assignedTo.filter((uid) => !previousAssignedTo.includes(uid));
      for (const userId of newlyAssigned) {
        await notifyAssignment({
          assignedToUserId: userId,
          fromUserId: check.user.id,
          fromUserName: check.user.name || check.user.email,
          type: "calendar_assigned",
          title: `Evento calendar assegnato: ${event.title}`,
          body: `Assegnato da ${check.user.name || check.user.email}`,
          relatedId: id,
        });
      }
    }

    return NextResponse.json(event);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const check = await loadEventWithAuth(request, id);
  if (check.error) return check.error;

  try {
    await deleteCalendarEvent(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
