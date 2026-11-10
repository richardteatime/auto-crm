import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { waStatus } from "@/lib/vendiora/wa";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const s = await waStatus();
  // Only founders get the QR (whoever scans it takes over the number)
  return NextResponse.json(auth.user.role === "admin" ? s : { ...s, qr: null });
}
