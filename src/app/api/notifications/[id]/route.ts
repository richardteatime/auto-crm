import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getNotification, markNotificationRead, deleteNotification } from "@/lib/db/notifications";

type Ctx = { params: Promise<{ id: string }> };

async function requireNotificationOwner(request: NextRequest, id: string) {
  const auth = await requireAuth(request);
  if (auth.error) return { error: auth.error };

  const notification = await getNotification(id);
  if (!notification) {
    return {
      error: NextResponse.json({ error: "Notifica non trovata" }, { status: 404 }),
    };
  }
  if (notification.userId !== auth.user.id) {
    return {
      error: NextResponse.json({ error: "Non autorizzato" }, { status: 403 }),
    };
  }
  return { user: auth.user, notification };
}

// PATCH /api/notifications/[id] — mark single notification as read
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const check = await requireNotificationOwner(request, id);
  if (check.error) return check.error;

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
  const { id } = await params;
  const check = await requireNotificationOwner(request, id);
  if (check.error) return check.error;

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
