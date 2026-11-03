import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLead } from "@/lib/db/leads";
import { convertLead } from "@/lib/leads/service";

type Ctx = { params: Promise<{ id: string }> };

// Founders only: lead → contact + deal in the main pipeline
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  try {
    const r = await convertLead(lead, { id: auth.user.id, name: auth.user.name }, {
      value: typeof body.value === "number" ? Math.round(body.value) : null,
      title: typeof body.title === "string" ? body.title : null,
    });
    return NextResponse.json(r);
  } catch (e) {
    console.error("[lead convert]", e);
    return NextResponse.json({ error: "Errore nella creazione della trattativa" }, { status: 500 });
  }
}
