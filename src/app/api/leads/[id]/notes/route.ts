import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLead, addLeadEvent } from "@/lib/db/leads";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!(await getLead(id))) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  let note: unknown;
  try {
    note = (await request.json()).note;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  if (typeof note !== "string" || !note.trim()) return NextResponse.json({ error: "Nota vuota" }, { status: 400 });
  const event = await addLeadEvent({
    leadId: id,
    type: "note",
    outcome: null,
    fromStatus: null,
    toStatus: null,
    note: note.trim(),
    actorId: auth.user.id,
    actorName: auth.user.name,
  });
  return NextResponse.json(event, { status: 201 });
}
