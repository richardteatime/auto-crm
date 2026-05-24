import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationsReadByType,
} from "@/lib/db/notifications";

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

  try {
    let body: { type?: string } = {};
    try {
      body = await request.json();
    } catch {
      // empty body is fine
    }

    if (body.type) {
      await markNotificationsReadByType(auth.user.id, body.type as "chat_message");
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
