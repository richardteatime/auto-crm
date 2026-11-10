import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLead, leadInScope } from "@/lib/db/leads";
import { listMessages, getConversationByLead } from "@/lib/vendiora/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const leadId = request.nextUrl.searchParams.get("leadId") || "";
  const lead = leadId ? await getLead(leadId) : null;
  if (!lead || !leadInScope(lead)) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  const [byLead, byPhone, conversation] = await Promise.all([
    listMessages({ leadId }),
    lead.phoneE164 ? listMessages({ phoneE164: lead.phoneE164 }) : Promise.resolve([]),
    getConversationByLead(leadId),
  ]);
  const seen = new Set<string>();
  const messages = [...byLead, ...byPhone]
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .sort((a, b) => a.at.localeCompare(b.at));
  return NextResponse.json({ messages, conversation });
}
