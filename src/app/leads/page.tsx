import { listLeads } from "@/lib/db";
import { LeadPipelineBoard } from "@/components/leads/LeadPipelineBoard";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await listLeads();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Lead Pipeline</h1>
        <p className="text-xs text-muted-foreground">
          Lead in ingresso dai form, organizzati per fase commerciale
        </p>
      </div>

      <LeadPipelineBoard leads={leads} />
    </div>
  );
}
