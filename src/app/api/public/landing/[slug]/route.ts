import { NextRequest, NextResponse } from "next/server";
import { getLandingPageBySlug } from "@/lib/db";

// Public read of a published landing page. Drafts and archived pages are
// treated as not found so unpublished work never leaks.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const page = await getLandingPageBySlug(slug);

  if (!page || page.status !== "published") {
    return NextResponse.json({ error: "Pagina non trovata" }, { status: 404 });
  }

  return NextResponse.json({
    id: page.id,
    name: page.name,
    slug: page.slug,
    config: page.config,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    ogImageUrl: page.ogImageUrl,
  });
}
