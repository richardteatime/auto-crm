import { notFound } from "next/navigation";
import {
  getLead,
  listPipelineMovements,
  listAutomationRuns,
  listCallTasks,
  listLeadQuotes,
} from "@/lib/db";
import { LeadDetail } from "@/components/leads/LeadDetail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lead = await getLead(id);

  if (!lead) {
    notFound();
  }

  const [movements, runs, callTasks, quotes] = await Promise.all([
    listPipelineMovements(id).catch(() => []),
    listAutomationRuns({ leadId: id }).catch(() => []),
    listCallTasks({ leadId: id }).catch(() => []),
    listLeadQuotes(id).catch(() => []),
  ]);

  return (
    <LeadDetail
      lead={lead}
      movements={movements}
      runs={runs}
      callTasks={callTasks}
      quotes={quotes}
    />
  );
}
