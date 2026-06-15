import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getLandingPage,
  updateLandingPage,
  deleteLandingPage,
  landingSlugExists,
} from "@/lib/db";
import { requireOwnerOrAdmin } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/appwrite";
import { slugify } from "@/lib/capture/slug";
const BodySchema = z.object({
  name: z.string().min(1).optional(),
  config: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  faviconUrl: z.string().nullable().optional(),
  ogImageUrl: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  slug: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(request, COLLECTIONS.landingPages, id);
  if (auth.error) return auth.error;

  const page = await getLandingPage(id);
  if (!page) {
    return NextResponse.json({ error: "Landing page non trovata" }, { status: 404 });
  }
  return NextResponse.json(page);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(request, COLLECTIONS.landingPages, id);
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

  const existing = await getLandingPage(id);
  if (!existing) {
    return NextResponse.json({ error: "Landing page non trovata" }, { status: 404 });
  }

  const data: Parameters<typeof updateLandingPage>[1] = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.config !== undefined) data.config = parsed.data.config;
  if (parsed.data.metaTitle !== undefined) data.metaTitle = parsed.data.metaTitle;
  if (parsed.data.metaDescription !== undefined) data.metaDescription = parsed.data.metaDescription;
  if (parsed.data.faviconUrl !== undefined) data.faviconUrl = parsed.data.faviconUrl;
  if (parsed.data.ogImageUrl !== undefined) data.ogImageUrl = parsed.data.ogImageUrl;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;

  if (parsed.data.slug !== undefined && parsed.data.slug.trim()) {
    const slug = slugify(parsed.data.slug);
    if (slug !== existing.slug && (await landingSlugExists(slug))) {
      return NextResponse.json({ error: "Slug già in uso" }, { status: 409 });
    }
    data.slug = slug;
  }

  try {
    const updated = await updateLandingPage(id, data);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'aggiornamento della landing page" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireOwnerOrAdmin(request, COLLECTIONS.landingPages, id);
  if (auth.error) return auth.error;

  const existing = await getLandingPage(id);
  if (!existing) {
    return NextResponse.json({ error: "Landing page non trovata" }, { status: 404 });
  }

  try {
    await deleteLandingPage(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore nell'eliminazione della landing page" },
      { status: 500 },
    );
  }
}
