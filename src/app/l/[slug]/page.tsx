import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getLandingPageBySlug } from "@/lib/db";
import { track, clientIp } from "@/lib/capture/analytics";
import {
  LandingBlockRenderer,
  parseLandingConfig,
} from "@/components/capture/LandingBlockRenderer";
import { PublicAnalyticsTracker } from "@/components/capture/PublicAnalyticsTracker";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLandingPageBySlug(slug);
  if (!page || page.status !== "published") {
    return { title: "Pagina non trovata" };
  }
  return {
    title: page.metaTitle || page.name,
    description: page.metaDescription || undefined,
    icons: page.faviconUrl ? { icon: page.faviconUrl } : undefined,
    openGraph: {
      title: page.metaTitle || page.name,
      description: page.metaDescription || undefined,
      images: page.ogImageUrl ? [{ url: page.ogImageUrl }] : undefined,
    },
  };
}

export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getLandingPageBySlug(slug);

  if (!page || page.status !== "published") {
    notFound();
  }

  // Fire-and-forget page view. track() never throws.
  const h = await headers();
  await track("page_view", "landing", page.id, {
    ip: clientIp(h),
    userAgent: h.get("user-agent"),
    referrer: h.get("referer"),
  });

  const config = parseLandingConfig(page.config);

  return (
    <main className="min-h-screen bg-white">
      <PublicAnalyticsTracker assetId={page.id} />
      <LandingBlockRenderer config={config} landingPageId={page.id} />
    </main>
  );
}
