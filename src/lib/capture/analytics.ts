// Server-side analytics tracking. Never throws — analytics must never block
// a public page render or a form submission.

import { createHash } from "crypto";
import { createAnalyticsEvent } from "@/lib/db/analytics-events";
import { incrementLandingCounter } from "@/lib/db/landing-pages";
import { incrementFormCounter } from "@/lib/db/forms";
import { incrementFunnelCounter } from "@/lib/db/funnels";
import type {
  AnalyticsAssetType,
  AnalyticsEventType,
} from "@/lib/capture/types";

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export interface TrackContext {
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  sessionId?: string | null;
}

/**
 * Record an analytics event and bump the relevant per-asset counter.
 * Swallows all errors by design.
 */
export async function track(
  eventType: AnalyticsEventType,
  assetType: AnalyticsAssetType,
  assetId: string,
  ctx: TrackContext = {},
): Promise<void> {
  try {
    await createAnalyticsEvent({
      eventType,
      assetType,
      assetId,
      sessionId: ctx.sessionId ?? null,
      ipHash: hashIp(ctx.ip),
      userAgent: ctx.userAgent ?? null,
      referrer: ctx.referrer ?? null,
    });

    if (["page_view", "form_view", "booking_page_view", "funnel_start"].includes(eventType)) {
      if (assetType === "landing") await incrementLandingCounter(assetId, "views");
      else if (assetType === "form") await incrementFormCounter(assetId, "views");
      else if (assetType === "funnel") await incrementFunnelCounter(assetId, "views");
    } else if (eventType === "form_submit" && assetType === "form") {
      await incrementFormCounter(assetId, "submissions");
    }
  } catch {
    // Analytics failures must stay invisible to the user.
  }
}

export function clientIp(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null
  );
}
