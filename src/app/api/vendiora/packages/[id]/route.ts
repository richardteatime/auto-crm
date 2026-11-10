import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updatePackage, deletePackage, getPackage } from "@/lib/vendiora/db";
import { readBody, fail } from "@/lib/vendiora/http";
import { packageFromBody } from "../parse";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!(await getPackage(id))) return NextResponse.json({ error: "Pacchetto non trovato" }, { status: 404 });
  const body = await readBody(request);
  if (body instanceof NextResponse) return body;
  const p = packageFromBody(body, false);
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: 400 });
  try { return NextResponse.json({ package: await updatePackage(id, p.data) }); } catch (e) { return fail(e); }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  // Sold packages keep their snapshot in the client record, so deleting is safe
  try { await deletePackage(id); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
