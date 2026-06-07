import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listLandingPages, createLandingPage, getLandingTemplate } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  name: z.string().min(1),
  templateId: z.string().optional(),
  config: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const templateId = parsed.data.templateId?.trim() || null;
    const template = templateId ? await getLandingTemplate(templateId) : null;
    if (templateId && !template) {
      return NextResponse.json({ error: "Template non trovato" }, { status: 404 });
    }
    const page = await createLandingPage({
      name: parsed.data.name.trim(),
      templateId,
      config: parsed.data.config ?? template?.config,
      metaTitle: parsed.data.metaTitle,
      metaDescription: parsed.data.metaDescription,
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
