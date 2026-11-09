import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { partnerFeeConfig } from "@/lib/partner-fee";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return NextResponse.json(partnerFeeConfig(auth.user.id));
}
