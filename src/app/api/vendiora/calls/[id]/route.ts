import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getCall, updateCall } from "@/lib/vendiora/db";
import { readBody, str, iso, fail } from "@/lib/vendiora/http";
import { isCallStatus } from "@/lib/vendiora/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const cur = await getCall(id);
  if (!cur) return NextResponse.json({ error: "Call non trovata" }, { status: 404 });
  const b = await readBody(request);
  if (b instanceof NextResponse) return b;
  const p: Parameters<typeof updateCall>[1] = {};
  if ("title" in b) p.title = str(b.title, 200) || cur.title;
  if ("notes" in b) p.notes = str(b.notes, 4000);
  if ("summary" in b) p.summary = str(b.summary, 20000);
  if ("homework" in b) p.homework = str(b.homework, 4000);
  if ("homeworkAt" in b) p.homeworkAt = iso(b.homeworkAt);
  if ("recordingUrl" in b) p.recordingUrl = str(b.recordingUrl, 1000);
  if ("dueAt" in b) p.dueAt = iso(b.dueAt);
  if ("scheduledAt" in b) {
    p.scheduledAt = iso(b.scheduledAt);
    if (p.scheduledAt && cur.status === "da_prenotare" && !("status" in b)) p.status = "prenotata";
  }
  if ("status" in b) {
    if (!isCallStatus(b.status)) return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    p.status = b.status;
    p.doneAt = b.status === "fatta" ? cur.doneAt ?? new Date().toISOString() : null;
  }
  try { return NextResponse.json({ call: await updateCall(id, p) }); } catch (e) { return fail(e); }
}
