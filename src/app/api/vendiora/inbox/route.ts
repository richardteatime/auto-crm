import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listLeads, leadInScope } from "@/lib/db/leads";
import { latestMessages, listConversations } from "@/lib/vendiora/db";

export const dynamic = "force-dynamic";

// WhatsApp inbox: one row per lead with a chat, newest activity first
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const [leads, convs, msgs] = await Promise.all([listLeads({ max: 2000 }), listConversations(), latestMessages(100)]);
  const byId = new Map(leads.filter(leadInScope).map((l) => [l.id, l]));
  const byPhone = new Map(leads.filter((l) => l.phoneE164 && byId.has(l.id)).map((l) => [l.phoneE164!, l]));
  const rows = new Map<string, { leadId: string; name: string; phone: string | null; status: string; state: string | null; lastText: string | null; lastAt: string | null; lastDir: string | null; unanswered: boolean }>();
  for (const c of convs) {
    const l = byId.get(c.leadId);
    if (!l) continue;
    rows.set(l.id, { leadId: l.id, name: l.name, phone: l.phoneE164, status: l.status, state: c.state, lastText: null, lastAt: c.lastInboundAt, lastDir: null, unanswered: false });
  }
  for (const m of msgs) {
    const l = (m.leadId && byId.get(m.leadId)) || (m.phoneE164 && byPhone.get(m.phoneE164)) || null;
    if (!l) continue;
    const r = rows.get(l.id) ?? { leadId: l.id, name: l.name, phone: l.phoneE164, status: l.status, state: null, lastText: null, lastAt: null, lastDir: null, unanswered: false };
    if (!r.lastText) { // msgs are newest first
      r.lastText = m.text; r.lastAt = m.at; r.lastDir = m.direction; r.unanswered = m.direction === "in";
    }
    rows.set(l.id, r);
  }
  const list = [...rows.values()].sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));
  return NextResponse.json({ chats: list });
}
