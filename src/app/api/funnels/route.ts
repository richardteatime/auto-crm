import { NextRequest, NextResponse } from "next/server";
import { createFunnel, listFunnels } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
  }

  try {
    const funnel = await createFunnel({ name, createdBy: auth.user.id });
    return NextResponse.json(funnel, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione del funnel" },
      { status: 500 },
    );
  }
}
