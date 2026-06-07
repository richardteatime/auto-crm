import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBookingLinkBySlug } from "@/lib/db";
import { availableSlotsForDate } from "@/lib/capture/booking-slots";
import { corsHeaders } from "@/lib/cors";

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, "GET, OPTIONS") });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = QuerySchema.safeParse(query);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Parametri non validi", issues: parsedQuery.error.issues },
      { status: 400, headers: corsHeaders(request, "GET, OPTIONS") },
    );
  }
  const { date } = parsedQuery.data;

  const link = await getBookingLinkBySlug(slug);
  if (!link || link.status !== "active") {
    return NextResponse.json({ error: "Link non trovato" }, { status: 404, headers: corsHeaders(request, "GET, OPTIONS") });
  }

  const slots = await availableSlotsForDate(link, date);

  return NextResponse.json(
    { date, durationMinutes: link.durationMinutes, slots },
    { headers: corsHeaders(request, "GET, OPTIONS") },
  );
}
