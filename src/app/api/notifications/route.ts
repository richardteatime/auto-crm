import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  listNotifications,
  markAllNotificationsRead,
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

// PATCH /api/notifications — mark all as read
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    await markAllNotificationsRead(auth.user.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento delle notifiche" },
      { status: 500 },
    );
  }
}
