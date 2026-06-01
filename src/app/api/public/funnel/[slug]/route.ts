import { NextRequest, NextResponse } from "next/server";
import { getFunnelBySlug } from "@/lib/db";
import { parseFunnelSteps } from "@/lib/capture/funnels";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const funnel = await getFunnelBySlug(slug);
  if (!funnel || funnel.status !== "active") {
    return NextResponse.json({ error: "Funnel non trovato" }, { status: 404 });
  }
  const steps = parseFunnelSteps(funnel.steps);
  return NextResponse.json({
    id: funnel.id,
    name: funnel.name,
    slug: funnel.slug,
    entryStepId: steps[0]?.id ?? null,
    steps: steps.map((step) => ({ id: step.id, name: step.name })),
  });
}
