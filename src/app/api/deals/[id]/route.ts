import { NextRequest, NextResponse } from "next/server";
import { canEditPartnerFee } from "@/lib/partner-fee";
import { clampPct } from "@/lib/partner-fee-shared";
import { getDeal, updateDeal, deleteDeal } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

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
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

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

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.value !== undefined) updateData.value = body.value;
    if (body.stageId !== undefined) updateData.stageId = body.stageId;
    if (body.contactId !== undefined) updateData.contactId = body.contactId;
    if (body.expectedClose !== undefined) {
      updateData.expectedClose = body.expectedClose ? new Date(body.expectedClose) : null;
    }
    if (body.probability !== undefined) {
      updateData.probability = Math.max(0, Math.min(100, Number(body.probability)));
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.attachments !== undefined) updateData.attachments = JSON.stringify(body.attachments ?? []);
    if (body.billingType !== undefined) updateData.billingType = ["una_tantum", "mensile", "annuale"].includes(body.billingType) ? body.billingType : "una_tantum";
    if (body.recurringMonths !== undefined) updateData.recurringMonths = Number(body.recurringMonths) || 12;
    if (body.isPaid !== undefined) updateData.isPaid = !!body.isPaid;
    if (body.partnerFeePct !== undefined) {
      if (!canEditPartnerFee(auth.user.id)) {
        return NextResponse.json({ error: "Non puoi cambiare la percentuale della fee" }, { status: 403 });
      }
      const pct = body.partnerFeePct === null ? null : clampPct(body.partnerFeePct);
      if (body.partnerFeePct !== null && pct === null) {
        return NextResponse.json({ error: "Percentuale non valida" }, { status: 400 });
      }
      updateData.partnerFeePct = pct;
    }

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
  const auth = await requireAuth(_request);
  if (auth.error) return auth.error;

  const { id } = await params;

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
