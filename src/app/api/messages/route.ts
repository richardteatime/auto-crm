import { NextRequest, NextResponse } from "next/server";
import { listMessages, createMessage } from "@/lib/db/messages";
import { createNotification } from "@/lib/db/notifications";
import { users } from "@/lib/appwrite";
import { requireAuth } from "@/lib/auth";
import { requireModule } from "@/lib/modules-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const modCheck = await requireModule("messages", req);
  if (modCheck) return modCheck;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  try {
    const rows = await listMessages(since || undefined);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Errore nel caricamento messaggi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const modCheck = await requireModule("messages", req);
  if (modCheck) return modCheck;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Contenuto obbligatorio" }, { status: 400 });
    }

    const msg = await createMessage({
      author: auth.user.name,
      content: content.trim(),
    });

    // Create notifications for all other users
    try {
      const allUsers = await users.list();
      await Promise.all(
        allUsers.users
          .filter((u) => u.$id !== auth.user.id)
          .map((u) =>
            createNotification({
              userId: u.$id,
              type: "chat_message",
              title: `Nuovo messaggio da ${auth.user.name}`,
              body: content.trim().slice(0, 200),
              relatedId: msg.id,
              relatedType: "message",
              fromUserId: auth.user.id,
              fromUserName: auth.user.name,
            })
          )
      );
    } catch (err) {
      console.error("[messages] failed to create notifications:", err);
    }

    return NextResponse.json(msg, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore nell'invio del messaggio" }, { status: 500 });
  }
}
