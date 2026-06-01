import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  createFunnelEvent,
  getFunnelBySlug,
  getLandingPage,
  getOrCreateFunnelSession,
  updateFunnelSession,
} from "@/lib/db";
import { clientIp, track } from "@/lib/capture/analytics";
import {
  isValidSessionId,
  parseFunnelSteps,
} from "@/lib/capture/funnels";
import {
  LandingBlockRenderer,
  parseLandingConfig,
} from "@/components/capture/LandingBlockRenderer";
import { PublicLeadForm } from "@/components/capture/PublicLeadForm";

export const dynamic = "force-dynamic";

export default async function PublicFunnelStep({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; stepId: string }>;
  searchParams: Promise<{ sid?: string }>;
}) {
  const { slug, stepId } = await params;
  const { sid } = await searchParams;
  if (!isValidSessionId(sid)) {
    redirect(
      `/f/${encodeURIComponent(slug)}/step/${encodeURIComponent(stepId)}?sid=${encodeURIComponent(randomUUID())}`,
    );
  }

  const funnel = await getFunnelBySlug(slug);
  if (!funnel || funnel.status !== "active") notFound();
  const step = parseFunnelSteps(funnel.steps).find((item) => item.id === stepId);
  if (!step) notFound();
  const landing = await getLandingPage(step.landingPageId);
  if (!landing) notFound();

  const session = await getOrCreateFunnelSession(funnel.id, sid);
  if (session.currentStep !== stepId) {
    await updateFunnelSession(session.id, { currentStep: stepId });
  }
  await createFunnelEvent({
    funnelId: funnel.id,
    sessionId: sid,
    stepId,
    eventType: "step_view",
  }).catch(() => undefined);
  const h = await headers();
  await track("step_view", "funnel", funnel.id, {
    ip: clientIp(h),
    userAgent: h.get("user-agent"),
    referrer: h.get("referer"),
    sessionId: sid,
  });

  const config = parseLandingConfig(landing.config);
  const hasForm = config.blocks.some((block) => block.type === "form");
  const submitUrl = `/api/public/funnel/${encodeURIComponent(slug)}/step/${encodeURIComponent(stepId)}/submit`;

  return (
    <main className="min-h-screen bg-white">
      <LandingBlockRenderer
        config={config}
        landingPageId={landing.id}
        funnelId={funnel.id}
        sessionId={sid}
        funnelSlug={slug}
        funnelStepId={stepId}
      />
      {!hasForm && (
        <section className="mx-auto max-w-xl px-6 py-16">
          <h2 className="mb-6 text-center text-2xl font-bold">Continua</h2>
          <PublicLeadForm
            landingPageId={landing.id}
            funnelId={funnel.id}
            sessionId={sid}
            source="funnel"
            submitUrl={submitUrl}
          />
        </section>
      )}
    </main>
  );
}
