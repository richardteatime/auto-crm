import { NextRequest, NextResponse } from "next/server";
import { waInboundAuthorized } from "@/lib/vendiora/wa";
import { handleInbound } from "@/lib/vendiora/bot";

// Called by the WhatsApp gateway for every message (in, and out when typed on the phone).
export async function POST(request: NextRequest) {
  if (!waInboundAuthorized(request.headers.get("x-wa-secret"))) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b.id !== "string" || typeof b.chatId !== "string" || typeof b.text !== "string") {
    return NextResponse.json({ error: "payload non valido" }, { status: 400 });
  }
  try {
    const r = await handleInbound({
      id: b.id,
      chatId: b.chatId,
      phone: typeof b.phone === "string" ? b.phone : null,
      fromMe: b.fromMe === true,
      text: b.text,
      ts: typeof b.ts === "number" ? b.ts : Date.now(),
      pushName: typeof b.pushName === "string" ? b.pushName : null,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[vendiora inbound]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "errore" }, { status: 500 });
  }
}
