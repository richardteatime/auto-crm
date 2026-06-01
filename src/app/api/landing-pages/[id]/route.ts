import { NextRequest, NextResponse } from "next/server";
import {
  getLandingPage,
  updateLandingPage,
  deleteLandingPage,
  landingSlugExists,
} from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { slugify } from "@/lib/capture/slug";
import type { AssetStatus } from "@/lib/capture/types";

const STATUSES: AssetStatus[] = ["draft", "published", "archived"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
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
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const existing = await getLandingPage(id);
  if (!existing) {
    return NextResponse.json({ error: "Landing page non trovata" }, { status: 404 });
  }

  const data: Parameters<typeof updateLandingPage>[1] = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.config === "string") data.config = body.config;
  if (typeof body.metaTitle === "string") data.metaTitle = body.metaTitle;
  if (typeof body.metaDescription === "string") data.metaDescription = body.metaDescription;
  if (body.faviconUrl !== undefined) data.faviconUrl = body.faviconUrl || null;
  if (body.ogImageUrl !== undefined) data.ogImageUrl = body.ogImageUrl || null;

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }
    data.status = body.status;
  }

  if (typeof body.slug === "string" && body.slug.trim()) {
    const slug = slugify(body.slug);
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
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
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
