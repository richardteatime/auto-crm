import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, track } from "@/lib/capture/analytics";
import { rateLimit } from "@/lib/capture/rate-limit";
import type { AnalyticsAssetType, AnalyticsEventType } from "@/lib/capture/types";

const EVENT_TYPES: AnalyticsEventType[] = [
  "page_view", "cta_click", "scroll_50", "scroll_90", "form_view", "form_start",
  "form_submit", "form_field_error", "booking_page_view", "slot_select",
  "booking_submit", "booking_confirm", "booking_complete", "funnel_start",
  "step_view", "step_submit", "funnel_complete", "funnel_abandon", "funnel_step",
];
const ASSET_TYPES: AnalyticsAssetType[] = ["landing", "form", "booking", "funnel"];

const BodySchema = z.object({
  eventType: z.string(),
  assetType: z.string(),
  assetId: z.string().min(1),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers) ?? "unknown";
  if (!(await rateLimit(`analytics:${ip}`, 120))) {
    return NextResponse.json({ success: false }, { status: 429 });
  }
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { eventType, assetType, assetId, sessionId } = parsed.data;
  if (
    !EVENT_TYPES.includes(eventType as AnalyticsEventType) ||
    !ASSET_TYPES.includes(assetType as AnalyticsAssetType)
  ) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  await track(eventType as AnalyticsEventType, assetType as AnalyticsAssetType, assetId, {
    ip,
    userAgent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
    sessionId: sessionId ?? null,
  });
  return NextResponse.json({ success: true }, { status: 201 });
}
