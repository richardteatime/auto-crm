import {
  listAnalyticsEvents,
  listBookingLinks,
  listForms,
  listFunnels,
  listLandingPages,
} from "@/lib/db";
import { CaptureAnalyticsDashboard } from "@/components/capture/CaptureAnalyticsDashboardClient";

export const dynamic = "force-dynamic";

const CONVERSION_EVENTS = new Set([
  "form_submit",
  "booking_confirm",
  "booking_complete",
  "funnel_complete",
]);
const VIEW_EVENTS = new Set(["page_view", "form_view", "booking_page_view", "funnel_start"]);

export default async function AnalyticsPage() {
  const [events, landingPages, forms, bookingLinks, funnels] = await Promise.all([
    listAnalyticsEvents(),
    listLandingPages(),
    listForms(),
    listBookingLinks(),
    listFunnels(),
  ]);

  const byDay = new Map<string, { day: string; views: number; conversions: number }>();
  for (const event of events) {
    const day = event.createdAt.toISOString().slice(0, 10);
    const item = byDay.get(day) ?? { day, views: 0, conversions: 0 };
    if (VIEW_EVENTS.has(event.eventType)) {
      item.views += 1;
    } else if (CONVERSION_EVENTS.has(event.eventType)) item.conversions += 1;
    byDay.set(day, item);
  }

  const assets = [
    ...landingPages.map((item) => ({ type: "Landing", name: item.name, views: item.views, conversions: item.submissions })),
    ...forms.map((item) => ({ type: "Form", name: item.name, views: item.views, conversions: item.submissions })),
    ...bookingLinks.map((item) => ({ type: "Booking", name: item.name, views: events.filter((event) => event.assetType === "booking" && event.assetId === item.id && event.eventType === "booking_page_view").length, conversions: item.bookingsCount })),
    ...funnels.map((item) => ({ type: "Funnel", name: item.name, views: item.views, conversions: item.conversions })),
  ].sort((a, b) => b.conversions - a.conversions || b.views - a.views);

  return (
    <CaptureAnalyticsDashboard
      assets={assets}
      daily={[...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-14)}
      totals={{
        assets: assets.length,
        views: events.filter((event) => VIEW_EVENTS.has(event.eventType)).length,
        conversions: events.filter((event) => CONVERSION_EVENTS.has(event.eventType)).length,
      }}
    />
  );
}
