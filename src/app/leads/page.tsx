import type { Metadata } from "next";
import { listLeads } from "@/lib/db/leads";
import { getServerUser } from "@/lib/auth-server";
import { firstNameOf } from "@/lib/names";
import { LeadsWorkspace } from "@/components/leads/LeadsWorkspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead" };

export default async function LeadsPage() {
  const [leads, user] = await Promise.all([listLeads(), getServerUser()]);
  const now = new Date();
  return <LeadsWorkspace leads={leads} nowMs={now.getTime()} userFirstName={user ? firstNameOf(user.name) : null} />;
}
