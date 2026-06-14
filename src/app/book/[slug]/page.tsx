import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getBookingLinkBySlug } from "@/lib/db";
import { track, clientIp } from "@/lib/capture/analytics";
import { parseAvailability } from "@/lib/capture/availability";
import { PublicBookingWidget } from "@/components/capture/PublicBookingWidget";
import { WEEKDAY_KEYS } from "@/lib/capture/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const link = await getBookingLinkBySlug(slug);
  if (!link || link.status !== "active") {
    return { title: "Prenotazione non trovata" };
  }
  return { title: `Prenota — ${link.name}` };
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const link = await getBookingLinkBySlug(slug);

  if (!link || link.status !== "active") {
    notFound();
  }

  const h = await headers();
  await track("booking_page_view", "booking", link.id, {
    ip: clientIp(h),
    userAgent: h.get("user-agent"),
    referrer: h.get("referer"),
  });

  const availability = parseAvailability(link.availability);
  const openDays = WEEKDAY_KEYS.filter((k) => availability.days[k]?.enabled);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">{link.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Durata: {link.durationMinutes} minuti
          </p>
        </div>
        <PublicBookingWidget
          assetId={link.id}
          slug={link.slug}
          durationMinutes={link.durationMinutes}
          openDays={openDays}
          availability={availability}
        />
      </div>
    </main>
  );
}
