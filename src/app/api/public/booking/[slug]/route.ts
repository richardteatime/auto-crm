import { NextRequest, NextResponse } from "next/server";
import { getBookingLinkBySlug } from "@/lib/db";
import { parseAvailability } from "@/lib/capture/availability";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const link = await getBookingLinkBySlug(slug);

  if (!link || link.status !== "active") {
    return NextResponse.json({ error: "Link non trovato" }, { status: 404, headers: CORS });
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
    { headers: CORS },
  );
}
