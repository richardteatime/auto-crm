import { NextRequest, NextResponse } from "next/server";
import { getOpportunity, updateOpportunity, createDeal, getStages } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(_req);
  if (auth.error) return auth.error;

  const { id } = await params;

  const opp = await getOpportunity(id);
  if (!opp) return NextResponse.json({ error: "Opportunità non trovata" }, { status: 404 });
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
  } catch {
    return NextResponse.json(
      { error: "Errore nella conversione" },
      { status: 500 }
    );
  }
}
