import { NextRequest, NextResponse } from "next/server";
import {
  getFullPipeline,
  replaceStages,
  updateDeal,
  getDeal,
  listDeals,
  getStages,
} from "@/lib/db";

export async function GET() {
  try {
    const pipeline = await getFullPipeline();
    return NextResponse.json(pipeline);
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nel recupero del pipeline: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  // Update a single deal's stage (drag and drop)
  if (body.dealId && body.stageId) {
    try {
      const existing = await getDeal(body.dealId);
      if (!existing) {
        return NextResponse.json(
          { error: "Trattativa non trovata" },
          { status: 404 }
        );
      }

      // updateDeal handles wonAt/recurringStartDate logic internally
      const result = await updateDeal(body.dealId, {
        stageId: body.stageId,
      });

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof Error && (error.message.includes("404") || error.message.includes("not found"))) {
        return NextResponse.json(
          { error: "Trattativa non trovata" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Errore nell'aggiornamento della trattativa: ${error instanceof Error ? error.message : "sconosciuto"}` },
        { status: 500 }
      );
    }
  }

  // Bulk update stages (from /setup or /customize)
  if (body.stages && Array.isArray(body.stages)) {
    try {
      // Check if any deals exist
      const existingDeals = await listDeals();
      if (existingDeals.length > 0) {
        return NextResponse.json(
          {
            error:
              "Non è possibile sostituire le fasi con trattative attive. Elimina prima le trattative.",
          },
          { status: 400 }
        );
      }

      await replaceStages(
        body.stages.map((stage: { name: string; order: number; color?: string; isWon?: boolean; isLost?: boolean }) => ({
          name: stage.name,
          order: stage.order,
          color: stage.color || "#64748b",
          isWon: stage.isWon || false,
          isLost: stage.isLost || false,
        }))
      );

      // Return stages sorted by order
      const allStages = await getStages();
      return NextResponse.json(allStages);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "sconosciuto";
      if (msg.includes("Cannot replace stages")) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      return NextResponse.json(
        { error: `Errore nell'aggiornamento delle fasi: ${msg}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
}
