import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLead, leadInScope } from "@/lib/db/leads";
import { findClientByLead, getConversationByLead, getSettings } from "@/lib/vendiora/db";
import { ANGLE_INFO, playbookPackage, type Angle } from "@/lib/vendiora/playbook";

export const dynamic = "force-dynamic";

/** Playbook view of a lead: angle, 3 qualification answers, score, recommended package, sales sequence */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead || !leadInScope(lead)) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  const [conv, s, client] = await Promise.all([getConversationByLead(id), getSettings(), findClientByLead(id).catch(() => null)]);
  const angle = (conv?.angle ?? null) as Angle | null;
  const info = angle && ANGLE_INFO[angle] ? ANGLE_INFO[angle] : null;
  const rec = playbookPackage(conv?.pkg ?? null);
  return NextResponse.json({
    enabled: s.playbook.enabled, isClient: !!client,
    angle, angleLabel: info?.label ?? null, pain: info?.pain ?? null, lever: info?.lever ?? null,
    answers: conv?.answers ?? [], score: conv?.score ?? null, qual: conv?.qual ?? null, state: conv?.state ?? null,
    recommended: rec ? { code: rec.code, name: rec.name, price: rec.price } : null,
    seq: Object.entries(conv?.seqLog ?? {}).map(([k, at]) => ({ k, at })).sort((a, b) => a.at.localeCompare(b.at)),
  });
}
