import { NextRequest, NextResponse } from "next/server";
import { listLandingTemplates } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    return NextResponse.json(await listLandingTemplates());
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero dei template" },
      { status: 500 },
    );
  }
}
