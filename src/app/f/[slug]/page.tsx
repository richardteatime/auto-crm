import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getFunnelBySlug } from "@/lib/db";
import { clientIp, track } from "@/lib/capture/analytics";
import { parseFunnelSteps } from "@/lib/capture/funnels";

export const dynamic = "force-dynamic";

export default async function PublicFunnelEntry({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const funnel = await getFunnelBySlug(slug);
  if (!funnel || funnel.status !== "active") notFound();
  const first = parseFunnelSteps(funnel.steps)[0];
  if (!first) notFound();

  const h = await headers();
  await track("funnel_start", "funnel", funnel.id, {
    ip: clientIp(h),
    userAgent: h.get("user-agent"),
    referrer: h.get("referer"),
  });

  redirect(
    `/f/${encodeURIComponent(slug)}/step/${encodeURIComponent(first.id)}?sid=${encodeURIComponent(randomUUID())}`,
  );
}
