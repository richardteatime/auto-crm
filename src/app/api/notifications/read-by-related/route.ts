import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { markNotificationsReadByRelated } from "@/lib/db/notifications";
import type { NotificationRelatedType } from "@/lib/db/notifications";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.relatedId || !body.relatedType) {
      return NextResponse.json(
        { error: "relatedId e relatedType obbligatori" },
        { status: 400 }
      );
    }
    await markNotificationsReadByRelated(
      auth.user.id,
      body.relatedId,
      body.relatedType as NotificationRelatedType
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento delle notifiche" },
      { status: 500 }
    );
  }
}
