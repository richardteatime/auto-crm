import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listRevenues, createRevenue } from "@/lib/db/revenues";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  description: z.string().min(1),
  amount: z.number().nonnegative(),
  date: z.string().datetime(),
  billingType: z.enum(["una_tantum", "mensile", "annuale"]).optional(),
  recurringMonths: z.number().optional(),
  startDate: z.string().datetime().optional().nullable(),
  collectedBy: z.array(z.string()).optional(),
  isExternal: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  opportunityId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const revenues = await listRevenues();
    return NextResponse.json(revenues);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
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

  try {
    const collectedBy: string[] = parsed.data.collectedBy ?? [];
    const revenue = await createRevenue({ ...parsed.data, collectedBy });
    return NextResponse.json(revenue, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
