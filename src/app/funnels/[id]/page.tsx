import { notFound } from "next/navigation";
import { getFunnel, listFunnelEvents, listLandingPages } from "@/lib/db";
import { FunnelEditor } from "@/components/capture/FunnelEditor";

export const dynamic = "force-dynamic";

export default async function FunnelEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [funnel, landingPages, events] = await Promise.all([
    getFunnel(id),
    listLandingPages(),
    listFunnelEvents(id),
  ]);
  if (!funnel) notFound();
  return <FunnelEditor funnel={funnel} landingPages={landingPages} events={events} />;
}
