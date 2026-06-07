import { NextRequest, NextResponse } from "next/server";
import { getBookingLinkBySlug } from "@/lib/db";
import { parseAvailability } from "@/lib/capture/availability";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, "GET, OPTIONS") });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const link = await getBookingLinkBySlug(slug);

  if (!link || link.status !== "active") {
    return NextResponse.json({ error: "Link non trovato" }, { status: 404, headers: corsHeaders(request, "GET, OPTIONS") });
  }

  const availability = parseAvailability(link.availability);
  // Only the weekly enabled flags are exposed publicly — never the buffers,
  // caps, or assignee, which are internal scheduling concerns.
  const openDays = Object.fromEntries(
    Object.entries(availability.days).map(([k, v]) => [k, Boolean(v?.enabled)]),
  );

  return NextResponse.json(
    {
      id: link.id,
      name: link.name,
      durationMinutes: link.durationMinutes,
      successMessage: link.successMessage,
      redirectUrl: link.redirectUrl,
      openDays,
    },
    { headers: corsHeaders(request, "GET, OPTIONS") },
  );
}
