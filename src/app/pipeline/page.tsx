import { getFullPipeline } from "@/lib/db";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const columns = await getFullPipeline();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="text-muted-foreground">
          Trascina e rilascia le trattative tra le fasi
        </p>
      </div>

      <KanbanBoard initialColumns={columns} />
    </div>
  );
}
