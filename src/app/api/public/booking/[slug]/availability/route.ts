import { NextRequest, NextResponse } from "next/server";
import { getBookingLinkBySlug } from "@/lib/db";
import { availableSlotsForDate } from "@/lib/capture/booking-slots";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const date = request.nextUrl.searchParams.get("date") ?? "";

  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "Parametro 'date' non valido (atteso YYYY-MM-DD)" },
      { status: 400, headers: CORS },
    );
  }

  const link = await getBookingLinkBySlug(slug);
  if (!link || link.status !== "active") {
    return NextResponse.json({ error: "Link non trovato" }, { status: 404, headers: CORS });
  }

  const slots = await availableSlotsForDate(link, date);

  return NextResponse.json(
    { date, durationMinutes: link.durationMinutes, slots },
    { headers: CORS },
  );
}
