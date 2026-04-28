import { NextRequest, NextResponse } from "next/server";
import { getOpportunity, updateOpportunity, createDeal, getStages } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const opp = await getOpportunity(id);
  if (!opp) return NextResponse.json({ error: "Opportunità non trovata" }, { status: 404 });
  if (opp.status === "trasformata") {
    return NextResponse.json({ error: "Opportunità già trasformata in trattativa" }, { status: 400 });
  }

  // Prende il primo stage del pipeline (ordine più basso)
  const stages = await getStages();
  const firstStage = stages.sort((a, b) => a.order - b.order)[0];
  if (!firstStage) {
    return NextResponse.json({ error: "Nessuno stage del pipeline configurato" }, { status: 400 });
  }

  try {
    // Crea la trattativa con i dati dell'opportunità
    const deal = await createDeal({
      title: opp.title,
      value: opp.value ?? 0,
      stageId: firstStage.id,
      contactId: opp.contactId,
      notes: opp.notes,
      probability: firstStage.isWon ? 100 : 10,
    });

    // Aggiorna l'opportunità come trasformata
    await updateOpportunity(id, { status: "trasformata", dealId: deal.id });

    return NextResponse.json({ deal, opportunityId: id });
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nella conversione: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}
