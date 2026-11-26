import { NextRequest, NextResponse } from "next/server";
import { closeDeal, CloseError } from "@/lib/db";
import { parseCloseReason } from "@/lib/close-reasons";
import { requireAuth } from "@/lib/auth";

// POST { reason } → close the deal as lost (what the trash icon does); it stays in the customer history
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const reason = parseCloseReason(body?.reason);
  if (!reason) {
    return NextResponse.json({ error: "Scrivi il motivo della chiusura", needsReason: true }, { status: 400 });
  }

  try {
    const result = await closeDeal(id, reason, auth.user.name || auth.user.email);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof CloseError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Errore nella chiusura" }, { status: 500 });
  }
}
