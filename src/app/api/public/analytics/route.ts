import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers) ?? "unknown";
  if (!rateLimit(`analytics:${ip}`, 120)) {
    return NextResponse.json({ success: false }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  const eventType = typeof body.eventType === "string" ? body.eventType : "";
  const assetType = typeof body.assetType === "string" ? body.assetType : "";
  const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : null;
  if (
    !EVENT_TYPES.includes(eventType as AnalyticsEventType) ||
    !ASSET_TYPES.includes(assetType as AnalyticsAssetType) ||
    !assetId
  ) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  await track(eventType as AnalyticsEventType, assetType as AnalyticsAssetType, assetId, {
    ip,
    userAgent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
    sessionId,
  });
  return NextResponse.json({ success: true }, { status: 201 });
}
