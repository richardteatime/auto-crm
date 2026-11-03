import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLead, listLeadEvents } from "@/lib/db/leads";
import { getServerUser } from "@/lib/auth-server";
import { firstNameOf } from "@/lib/names";
import { LeadDetail } from "@/components/leads/LeadDetail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lead = await getLead(id);
  return { title: lead ? lead.name : "Lead" };
}

export default async function LeadPage({ params }: Props) {
  const { id } = await params;
  const [lead, events, user] = await Promise.all([getLead(id), listLeadEvents(id).catch(() => []), getServerUser()]);
  if (!lead) notFound();
  const now = new Date();
  return (
    <LeadDetail
      lead={lead}
      events={events}
      nowMs={now.getTime()}
      isAdmin={user?.role === "admin"}
      userFirstName={user ? firstNameOf(user.name) : null}
    />
  );
}
