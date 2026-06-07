import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createFunnel, listFunnels } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  name: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    return NextResponse.json(await listFunnels());
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero dei funnel" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const funnel = await createFunnel({ name: parsed.data.name.trim(), createdBy: auth.user.id });
    return NextResponse.json(funnel, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione del funnel" },
      { status: 500 },
    );
  }
}
