import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listActivities, createActivity } from "@/lib/db";
import { VALID_ACTIVITY_TYPES } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";
import { notifyAssignment } from "@/lib/notify";

const QuerySchema = z.object({
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  assignedTo: z.string().optional(),
});

const BodySchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
  contactId: z.string().min(1),
  dealId: z.string().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
  assignedTo: z.string().optional().nullable(),
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
    const results = await listActivities({
      contactId: parsedQuery.data.contactId,
      dealId: parsedQuery.data.dealId,
      assignedTo: parsedQuery.data.assignedTo,
    });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero delle attività" },
      { status: 500 }
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (!VALID_ACTIVITY_TYPES.includes(parsed.data.type as (typeof VALID_ACTIVITY_TYPES)[number])) {
    return NextResponse.json(
      { error: "Tipo di attività non valido" },
      { status: 400 }
    );
  }

  try {
    const result = await createActivity({
      type: parsed.data.type as (typeof VALID_ACTIVITY_TYPES)[number],
      description: parsed.data.description,
      contactId: parsed.data.contactId,
      createdBy: auth.user.id,
      dealId: parsed.data.dealId ?? null,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : null,
      endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
      notes: parsed.data.notes ?? null,
      attachments: parsed.data.attachments ? JSON.stringify(parsed.data.attachments) : null,
      completedAt: null,
      isCompleted: false,
      assignedTo: parsed.data.assignedTo ?? null,
    });

    if (parsed.data.assignedTo) {
      await notifyAssignment({
        assignedToUserId: parsed.data.assignedTo,
        fromUserId: auth.user.id,
        fromUserName: auth.user.name || auth.user.email,
        type: "activity_assigned",
        title: `Nuova attività assegnata: ${parsed.data.description}`,
        body: `Assegnata da ${auth.user.name || auth.user.email}`,
        relatedId: result.id,
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione dell'attività" },
      { status: 500 }
    );
  }
}
