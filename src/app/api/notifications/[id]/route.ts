import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { markNotificationRead, deleteNotification } from "@/lib/db/notifications";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/notifications/[id] — mark single notification as read
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const notification = await markNotificationRead(id);
    return NextResponse.json(notification);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento della notifica" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    await deleteNotification(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'eliminazione della notifica" },
      { status: 500 },
    );
  }
}
