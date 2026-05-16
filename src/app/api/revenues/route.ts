import { NextRequest, NextResponse } from "next/server";
import { listRevenues, createRevenue } from "@/lib/db/revenues";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const revenues = await listRevenues();
    return NextResponse.json(revenues);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.description?.trim()) {
      return NextResponse.json({ error: "descrizione obbligatoria" }, { status: 400 });
    }
    if (typeof body.amount !== "number" || body.amount < 0) {
      return NextResponse.json({ error: "importo obbligatorio" }, { status: 400 });
    }
    const collectedBy: string[] = Array.isArray(body.collectedBy) ? body.collectedBy : [];
    const revenue = await createRevenue({ ...body, collectedBy });
    return NextResponse.json(revenue, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
