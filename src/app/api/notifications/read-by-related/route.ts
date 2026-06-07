import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { markNotificationsReadByRelated } from "@/lib/db/notifications";
import type { NotificationRelatedType } from "@/lib/db/notifications";

const BodySchema = z.object({
  relatedId: z.string().min(1),
  relatedType: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    await markNotificationsReadByRelated(
      auth.user.id,
      parsed.data.relatedId,
      parsed.data.relatedType as NotificationRelatedType
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento delle notifiche" },
      { status: 500 }
    );
  }
}
