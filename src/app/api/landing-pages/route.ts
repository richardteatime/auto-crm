import { NextRequest, NextResponse } from "next/server";
import { listLandingPages, createLandingPage, getLandingTemplate } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const pages = await listLandingPages();
    return NextResponse.json(pages);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero delle landing page" },
      { status: 500 },
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Il nome è obbligatorio" }, { status: 400 });
  }

  try {
    const templateId =
      typeof body.templateId === "string" && body.templateId.trim()
        ? body.templateId.trim()
        : null;
    const template = templateId ? await getLandingTemplate(templateId) : null;
    if (templateId && !template) {
      return NextResponse.json({ error: "Template non trovato" }, { status: 404 });
    }
    const page = await createLandingPage({
      name,
      templateId,
      config:
        typeof body.config === "string"
          ? body.config
          : template?.config,
      metaTitle: typeof body.metaTitle === "string" ? body.metaTitle : undefined,
      metaDescription:
        typeof body.metaDescription === "string" ? body.metaDescription : undefined,
      createdBy: auth.user.id,
    });
    return NextResponse.json(page, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione della landing page" },
      { status: 500 },
    );
  }
}
