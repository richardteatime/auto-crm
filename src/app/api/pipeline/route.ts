import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getFullPipeline,
  replaceStages,
  updateDeal,
  getDeal,
  listDeals,
  getStages,
} from "@/lib/db";
import { requireAuth, requireOwnerOrAdmin, isAdmin } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/appwrite";
import { triggerWorkflows } from "@/lib/workflows/trigger";

const MoveDealSchema = z.object({
  dealId: z.string().min(1),
  stageId: z.string().min(1),
});

const StageSchema = z.object({
  name: z.string().min(1),
  order: z.number(),
  color: z.string().optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});

const ReplaceStagesSchema = z.object({
  stages: z.array(StageSchema),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const pipeline = await getFullPipeline();
    return NextResponse.json(pipeline);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero del pipeline" },
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

  const moveParsed = MoveDealSchema.safeParse(body);
  if (moveParsed.success) {
    const auth = await requireOwnerOrAdmin(request, COLLECTIONS.deals, moveParsed.data.dealId);
    if (auth.error) return auth.error;

    try {
      const existing = await getDeal(moveParsed.data.dealId);
      if (!existing) {
        return NextResponse.json(
          { error: "Trattativa non trovata" },
          { status: 404 }
        );
      }

      const previousStageId = existing.stageId;
      const result = await updateDeal(moveParsed.data.dealId, {
        stageId: moveParsed.data.stageId,
      });

      await triggerWorkflows("deal_moved", {
        dealId: moveParsed.data.dealId,
        stageId: moveParsed.data.stageId,
        previousStageId,
        contactId: existing.contactId,
        title: existing.title,
        value: existing.value,
      }).catch(() => {});

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof Error && (error.message.includes("404") || error.message.includes("not found"))) {
        return NextResponse.json(
          { error: "Trattativa non trovata" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Errore nell'aggiornamento della trattativa" },
        { status: 500 }
      );
    }
  }

  const stagesParsed = ReplaceStagesSchema.safeParse(body);
  if (stagesParsed.success) {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (!(await isAdmin(auth.user.id))) {
      return NextResponse.json({ error: "Richiede ruolo admin" }, { status: 403 });
    }

    try {
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
        stagesParsed.data.stages.map((stage) => ({
          name: stage.name,
          order: stage.order,
          color: stage.color || "#64748b",
          isWon: stage.isWon || false,
          isLost: stage.isLost || false,
        }))
      );

      const allStages = await getStages();
      return NextResponse.json(allStages);
    } catch {
      return NextResponse.json(
        { error: "Errore nell'aggiornamento delle fasi" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
}
