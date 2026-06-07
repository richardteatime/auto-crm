import { notFound } from "next/navigation";
import { getWorkflow } from "@/lib/db";
import nextDynamic from "next/dynamic";

const WorkflowEditor = nextDynamic(
  () => import("@/components/workflows/WorkflowEditor").then((m) => m.WorkflowEditor),
  { ssr: false },
);

export const dynamic = "force-dynamic";

export default async function WorkflowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workflow = await getWorkflow(id);
  if (!workflow) notFound();

  return <WorkflowEditor workflow={workflow} />;
}
