import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listBookingLinksByAssignee } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const links = await listBookingLinksByAssignee(auth.user.id);
    return NextResponse.json(links.filter((link) => link.status !== "archived"));
  } catch {
    return NextResponse.json(
      { error: "Errore nel caricamento dei link" },
      { status: 500 },
    );
  }
}
