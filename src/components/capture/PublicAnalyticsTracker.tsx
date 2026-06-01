"use client";

import { useEffect } from "react";
import type { AnalyticsAssetType, AnalyticsEventType } from "@/lib/capture/types";

export function sendPublicAnalytics(
  eventType: AnalyticsEventType,
  assetType: AnalyticsAssetType,
  assetId: string,
  sessionId?: string | null,
) {
  void fetch("/api/public/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, assetType, assetId, sessionId }),
    keepalive: true,
  }).catch(() => undefined);
}

export function PublicAnalyticsTracker({
  assetId,
  sessionId,
}: {
  assetId: string;
  sessionId?: string | null;
}) {
  useEffect(() => {
    const sent = new Set<string>();
    const once = (event: AnalyticsEventType) => {
      if (sent.has(event)) return;
      sent.add(event);
      sendPublicAnalytics(event, "landing", assetId, sessionId);
    };
    const scroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const ratio = window.scrollY / max;
      if (ratio >= 0.5) once("scroll_50");
      if (ratio >= 0.9) once("scroll_90");
    };
    const click = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest("a[data-sx-cta]")) once("cta_click");
    };
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("click", click);
    };
  }, [assetId, sessionId]);
  return null;
}
