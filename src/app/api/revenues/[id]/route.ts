import { NextRequest, NextResponse } from "next/server";
import { getRevenue, updateRevenue, softDeleteRevenue } from "@/lib/db/revenues";
import { requireAuth } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const revenue = await getRevenue(id);
  if (!revenue) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json(revenue);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const body = await request.json();
    const collectedBy: string[] | undefined = body.collectedBy !== undefined
      ? (Array.isArray(body.collectedBy) ? body.collectedBy : [])
      : undefined;
    const revenue = await updateRevenue(id, collectedBy !== undefined ? { ...body, collectedBy } : body);
    return NextResponse.json(revenue);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    if (!body.reason?.trim()) {
      return NextResponse.json({ error: "Motivazione obbligatoria" }, { status: 400 });
    }
    await softDeleteRevenue(id, body.reason.trim());
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
