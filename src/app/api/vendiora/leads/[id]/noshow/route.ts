import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLead, leadInScope } from "@/lib/db/leads";
import { salesNoShow } from "@/lib/vendiora/engine";

export const dynamic = "force-dynamic";

/** The lead did not show up at the sales call: playbook no-show recovery (M2) */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead || !leadInScope(lead)) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  await salesNoShow(lead);
  return NextResponse.json({ ok: true });
}
