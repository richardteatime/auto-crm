import { NextRequest, NextResponse } from "next/server";
import { getLandingPage, createLandingPage } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const source = await getLandingPage(id);
  if (!source) {
    return NextResponse.json({ error: "Landing page non trovata" }, { status: 404 });
  }

  try {
    const copy = await createLandingPage({
      name: `${source.name} (copia)`,
      config: source.config,
      templateId: source.templateId,
      metaTitle: source.metaTitle,
      metaDescription: source.metaDescription,
      createdBy: auth.user.id,
    });
    return NextResponse.json(copy, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella duplicazione" },
      { status: 500 },
    );
  }
}
