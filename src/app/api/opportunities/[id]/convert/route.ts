import { NextRequest, NextResponse } from "next/server";
import { getOpportunity, updateOpportunity, createDeal, getStages, getDeal } from "@/lib/db";
import { requireOwnerOrAdmin } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/appwrite";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsAwaited = await params;
  const auth = await requireOwnerOrAdmin(_req, COLLECTIONS.opportunities, paramsAwaited.id);
  if (auth.error) return auth.error;

  const { id } = paramsAwaited;

  const opp = await getOpportunity(id);
  if (!opp) return NextResponse.json({ error: "Opportunità non trovata" }, { status: 404 });

  // Idempotency: if already converted, return the existing deal.
  if (opp.status === "trasformata" && opp.dealId) {
    const existing = await getDeal(opp.dealId);
    if (existing) {
      return NextResponse.json({ deal: existing, opportunityId: id });
    }
  }

  if (opp.status === "trasformata") {
    return NextResponse.json({ error: "Opportunità già trasformata in trattativa" }, { status: 400 });
  }

  const stages = await getStages();
  const firstStage = stages.sort((a, b) => a.order - b.order)[0];
  if (!firstStage) {
    return NextResponse.json({ error: "Nessuno stage del pipeline configurato" }, { status: 400 });
  }

  try {
    const deal = await createDeal({
      title: opp.title,
      value: opp.value ?? 0,
      stageId: firstStage.id,
      contactId: opp.contactId,
      notes: opp.notes,
      probability: firstStage.isWon ? 100 : 10,
    });

    await updateOpportunity(id, { status: "trasformata", dealId: deal.id });

    return NextResponse.json({ deal, opportunityId: id });
  } catch (error) {
    console.error("[opportunities/convert] Conversion failed:", error);
    return NextResponse.json(
      { error: "Errore nella conversione" },
      { status: 500 }
    );
  }
}
