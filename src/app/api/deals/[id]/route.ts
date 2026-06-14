import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDeal, updateDeal, deleteDeal } from "@/lib/db";
import { requireAuth, requireOwnerOrAdmin } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/appwrite";

const BodySchema = z.object({
  title: z.string().optional(),
  value: z.number().optional(),
  stageId: z.string().optional(),
  contactId: z.string().optional(),
  expectedClose: z.string().datetime().optional().nullable(),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().optional().nullable(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
  billingType: z.enum(["una_tantum", "mensile", "annuale"]).optional(),
  recurringMonths: z.number().optional().nullable(),
  isPaid: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(_request);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const deal = await getDeal(id);

    if (!deal) {
      return NextResponse.json(
        { error: "Trattativa non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(deal);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero della trattativa" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await requireOwnerOrAdmin(request, COLLECTIONS.deals, id);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  try {
    const existing = await getDeal(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Trattativa non trovata" },
        { status: 404 }
      );
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.value !== undefined) updateData.value = parsed.data.value;
    if (parsed.data.stageId !== undefined) updateData.stageId = parsed.data.stageId;
    if (parsed.data.contactId !== undefined) updateData.contactId = parsed.data.contactId;
    if (parsed.data.expectedClose !== undefined) {
      updateData.expectedClose = parsed.data.expectedClose ? new Date(parsed.data.expectedClose) : null;
    }
    if (parsed.data.probability !== undefined) {
      updateData.probability = Math.max(0, Math.min(100, parsed.data.probability));
    }
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.attachments !== undefined) updateData.attachments = JSON.stringify(parsed.data.attachments ?? []);
    if (parsed.data.billingType !== undefined) updateData.billingType = parsed.data.billingType;
    if (parsed.data.recurringMonths !== undefined) updateData.recurringMonths = parsed.data.recurringMonths ?? 12;
    if (parsed.data.isPaid !== undefined) updateData.isPaid = parsed.data.isPaid;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existing);
    }

    const result = await updateDeal(id, updateData);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento della trattativa" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await requireOwnerOrAdmin(_request, COLLECTIONS.deals, id);
  if (auth.error) return auth.error;

  try {
    const existing = await getDeal(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Trattativa non trovata" },
        { status: 404 }
      );
    }

    await deleteDeal(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'eliminazione della trattativa" },
      { status: 500 }
    );
  }
}
