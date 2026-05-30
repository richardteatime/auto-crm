import { listRuns } from "@/lib/orchestrator/runs";
import { RunsTable } from "@/components/orchestrator/RunsTable";

export const dynamic = "force-dynamic";

export default async function OrchestratorPage() {
  const runs = await listRuns({ limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Orchestrator</h1>
        <p className="text-xs text-muted-foreground">
          Dashboard delle run e dei workflow AI
        </p>
      </div>

      <RunsTable runs={runs} />
    </div>
  );
}
