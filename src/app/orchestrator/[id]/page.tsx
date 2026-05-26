import { notFound } from "next/navigation";
import { getOrchestratorRun } from "@/lib/db/orchestrator-runs";
import { listWorkflowEvents } from "@/lib/db/workflow-events";
import { listAgentTasks } from "@/lib/db/agent-tasks";
import { listProjectArtifacts } from "@/lib/db/project-artifacts";
import { RunDetail } from "@/components/orchestrator/RunDetail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: PageProps) {
  const { id } = await params;
  const run = await getOrchestratorRun(id);

  if (!run) {
    notFound();
  }

  const [events, tasks, artifacts] = await Promise.all([
    listWorkflowEvents({ runId: id, limit: 100 }).catch(() => []),
    listAgentTasks({ runId: id }).catch(() => []),
    listProjectArtifacts({ runId: id }).catch(() => []),
  ]);

  return (
    <RunDetail
      run={run}
      events={events}
      tasks={tasks}
      artifacts={artifacts}
    />
  );
}
