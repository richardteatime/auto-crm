import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteTask, updateTask } from "@/lib/vendiora/db";
import { readBody, iso, fail } from "@/lib/vendiora/http";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await readBody(request);
  if (b instanceof NextResponse) return b;
  try {
    if (b.status === "fatto" || b.status === "aperto") {
      const done = b.status === "fatto";
      return NextResponse.json({ task: await updateTask(id, { status: b.status, doneAt: done ? new Date().toISOString() : null, doneBy: done ? auth.user.name || auth.user.email : null }) });
    }
    if ("dueAt" in b) return NextResponse.json({ task: await updateTask(id, { dueAt: iso(b.dueAt) }) });
    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  } catch (e) { return fail(e); }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  try { await deleteTask(id); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
