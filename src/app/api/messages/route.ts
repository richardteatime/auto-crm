import { NextRequest, NextResponse } from "next/server";
import { listMessages, createMessage } from "@/lib/db/messages";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

    return NextResponse.json(msg, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore nell'invio del messaggio" }, { status: 500 });
  }
}
