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

  // Two-call funnel identities (env-overridable, resolved server-side).
  const setterId = process.env.CUGINA_USER_ID || "cugina";
  const setterName = process.env.CUGINA_NAME || "Cugina di Rick";
  const closerName = process.env.LEO_NAME || "Leo";

  return (
    <LeadDetail
      lead={lead}
      movements={movements}
      runs={runs}
      callTasks={callTasks}
      quotes={quotes}
      setterId={setterId}
      setterName={setterName}
      closerName={closerName}
    />
  );
}
