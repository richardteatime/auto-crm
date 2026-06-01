import { NextRequest, NextResponse } from "next/server";
import { createFunnel, getFunnel } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const funnel = await getFunnel(id);
  if (!funnel) {
    return NextResponse.json({ error: "Funnel non trovato" }, { status: 404 });
  }
  try {
    const copy = await createFunnel({
      name: `${funnel.name} (copia)`,
      steps: funnel.steps,
      thankYouPageId: funnel.thankYouPageId,
      createdBy: auth.user.id,
    });
    return NextResponse.json(copy, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore nella duplicazione" }, { status: 500 });
  }
}
