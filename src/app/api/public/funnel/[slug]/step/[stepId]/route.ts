import { NextRequest, NextResponse } from "next/server";
import { getFunnelBySlug, getLandingPage } from "@/lib/db";
import { parseFunnelSteps } from "@/lib/capture/funnels";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; stepId: string }> },
) {
  const { slug, stepId } = await params;
  const funnel = await getFunnelBySlug(slug);
  if (!funnel || funnel.status !== "active") {
    return NextResponse.json({ error: "Funnel non trovato" }, { status: 404 });
  }
  const step = parseFunnelSteps(funnel.steps).find((item) => item.id === stepId);
  if (!step) {
    return NextResponse.json({ error: "Step non trovato" }, { status: 404 });
  }
  const landing = await getLandingPage(step.landingPageId);
  if (!landing) {
    return NextResponse.json({ error: "Landing page non trovata" }, { status: 404 });
  }
  return NextResponse.json({
    funnelId: funnel.id,
    step: { id: step.id, name: step.name },
    landingPage: {
      id: landing.id,
      name: landing.name,
      config: landing.config,
    },
  });
}
