import { notFound } from "next/navigation";
import { getLandingPage } from "@/lib/db";
import { LandingPageEditor } from "@/components/capture/LandingPageEditor";

export const dynamic = "force-dynamic";

export default async function LandingPageEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await getLandingPage(id);
  if (!page) notFound();

  return <LandingPageEditor page={page} />;
}
