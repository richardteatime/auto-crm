import { NextRequest, NextResponse } from "next/server";
import { getLandingPage, updateLandingPage } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { AssetStatus } from "@/lib/capture/types";

const STATUSES: AssetStatus[] = ["draft", "published", "archived"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const existing = await getLandingPage(id);
  if (!existing) {
    return NextResponse.json({ error: "Landing page non trovata" }, { status: 404 });
  }

  let status: AssetStatus = "published";
  try {
    const body = await request.json();
    if (body?.status && STATUSES.includes(body.status)) status = body.status;
  } catch {
    // No body → default to publish.
  }

  try {
    const updated = await updateLandingPage(id, { status });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Errore nel cambio di stato" },
      { status: 500 },
    );
  }
}
