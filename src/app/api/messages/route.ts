import { NextRequest, NextResponse } from "next/server";
import { listMessages, createMessage } from "@/lib/db/messages";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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
  try {
    const { author, content } = await req.json();

    if (!author?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Autore e contenuto obbligatori" }, { status: 400 });
    }

    const msg = await createMessage({
      author: author.trim(),
      content: content.trim(),
    });

    return NextResponse.json(msg, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore nell'invio del messaggio" }, { status: 500 });
  }
}
