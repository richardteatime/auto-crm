import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationsReadByType,
} from "@/lib/db/notifications";

const BodySchema = z.object({
  type: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const notifications = await listNotifications(auth.user.id);
    return NextResponse.json(notifications);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero delle notifiche" },
      { status: 500 },
    );
  }
}

// PATCH /api/notifications — mark all as read (or by type if body.type is provided)
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.type) {
      await markNotificationsReadByType(auth.user.id, parsed.data.type as "chat_message");
    } else {
      await markAllNotificationsRead(auth.user.id);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento delle notifiche" },
      { status: 500 },
    );
  }
}
