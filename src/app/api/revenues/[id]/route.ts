import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRevenue, updateRevenue, softDeleteRevenue } from "@/lib/db/revenues";
import { requireAuth } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

const PutBodySchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().nonnegative().optional(),
  date: z.string().datetime().optional(),
  billingType: z.enum(["una_tantum", "mensile", "annuale"]).optional(),
  recurringMonths: z.number().optional(),
  startDate: z.string().datetime().optional().nullable(),
  collectedBy: z.array(z.string()).optional(),
  isExternal: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  opportunityId: z.string().optional().nullable(),
});

const DeleteBodySchema = z.object({
  reason: z.string().min(1),
});

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const revenue = await getRevenue(id);
  if (!revenue) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json(revenue);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = PutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const collectedBy: string[] | undefined = parsed.data.collectedBy !== undefined
      ? parsed.data.collectedBy
      : undefined;
    const revenue = await updateRevenue(id, collectedBy !== undefined ? { ...parsed.data, collectedBy } : parsed.data);
    return NextResponse.json(revenue);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = DeleteBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    await softDeleteRevenue(id, parsed.data.reason.trim());
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
