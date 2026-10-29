import type { Metadata } from "next";
import { getFullPipeline } from "@/lib/db";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { PageHeader } from "@/components/shared/PageHeader";
import { QuickCreateButton } from "@/components/shared/QuickCreateButton";
import { formatCurrencyShort } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const now = new Date();
  const columns = await getFullPipeline();
  const open = columns.filter((c) => !c.isWon && !c.isLost).flatMap((c) => c.deals);
  const openValue = open.reduce((s, d) => s + (d.value ?? 0), 0);
  const weighted = open.reduce((s, d) => s + ((d.value ?? 0) * (d.probability ?? 0)) / 100, 0);

  // Remount the board when the server data changes (e.g. after creating a deal)
  const dataKey = columns.map((c) => c.deals.map((d) => `${d.id}:${d.stageId}:${d.updatedAt}`).join(",")).join("|");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pipeline"
        description={
          <>
            {open.length} trattative aperte ·{" "}
            <span className="font-semibold text-foreground tabular-nums">{formatCurrencyShort(openValue)}</span> in corso ·{" "}
            <span className="tabular-nums">{formatCurrencyShort(Math.round(weighted))}</span> ponderato
          </>
        }
        actions={<QuickCreateButton kind="deal" label="Nuova trattativa" />}
      />
      <KanbanBoard key={dataKey} initialColumns={columns} nowMs={now.getTime()} />
    </div>
  );
}
