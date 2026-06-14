import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listDeals, createDeal, getStages } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  title: z.string().min(1),
  value: z.number().optional(),
  stageId: z.string().optional(),
  contactId: z.string().min(1),
  expectedClose: z.string().datetime().optional().nullable(),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().optional().nullable(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
  billingType: z.enum(["una_tantum", "mensile", "annuale"]).optional(),
  recurringMonths: z.number().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const results = await listDeals();
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero delle trattative" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Get first stage if none provided
  let finalStageId = parsed.data.stageId;
  if (!finalStageId) {
    const stages = await getStages();
    finalStageId = stages[0]?.id;
  }

  if (!finalStageId) {
    return NextResponse.json(
      { error: "Nessuna fase del pipeline configurata" },
      { status: 400 }
    );
  }

  try {
    const result = await createDeal({
      title: parsed.data.title.trim(),
      value: parsed.data.value ?? 0,
      stageId: finalStageId,
      contactId: parsed.data.contactId,
      expectedClose: parsed.data.expectedClose ? new Date(parsed.data.expectedClose) : null,
      probability: parsed.data.probability ?? 0,
      notes: parsed.data.notes ?? null,
      attachments: parsed.data.attachments ? JSON.stringify(parsed.data.attachments) : "[]",
      billingType: parsed.data.billingType ?? "una_tantum",
      recurringMonths: parsed.data.billingType !== "una_tantum" ? (parsed.data.recurringMonths ?? 12) : null,
      createdBy: auth.user.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione della trattativa" },
      { status: 500 }
    );
  }
}
