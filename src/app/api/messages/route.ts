import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listMessages, createMessage } from "@/lib/db/messages";
import { createNotification } from "@/lib/db/notifications";
import { users } from "@/lib/appwrite";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  since: z.string().datetime().optional(),
});

const BodySchema = z.object({
  content: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsedQuery = QuerySchema.safeParse(queryObj);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Parametri non validi", issues: parsedQuery.error.issues },
      { status: 400 }
    );
  }

  try {
    const rows = await listMessages(parsedQuery.data.since || undefined);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Errore nel caricamento messaggi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const content = parsed.data.content.trim();

    const msg = await createMessage({
      author: auth.user.name,
      content: content.trim(),
      createdBy: auth.user.id,
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
