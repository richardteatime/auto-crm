import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { journeyBoard, journeyTimeline } from "@/lib/vendiora/journey";
import { fail } from "@/lib/vendiora/http";

export const dynamic = "force-dynamic";

/** ?leadId= / ?clientId= → timeline of one person; nothing → the stage board */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const sp = request.nextUrl.searchParams;
  try {
    if (sp.get("leadId") || sp.get("clientId")) return NextResponse.json(await journeyTimeline({ leadId: sp.get("leadId"), clientId: sp.get("clientId") }));
    const p = sp.get("pipeline");
    return NextResponse.json(await journeyBoard(p === "consulenza" || p === "dfy" || p === "upsell" ? p : "vendite"));
  } catch (e) { return fail(e); }
}
