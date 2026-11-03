import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth";
import { listLeads } from "@/lib/db/leads";
import { ingestLead } from "@/lib/leads/service";
import { isLeadStatus, type LeadStatus } from "@/lib/leads/types";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const statuses = (new URL(request.url).searchParams.get("status") || "")
    .split(",")
    .filter(isLeadStatus) as LeadStatus[];
  try {
    return NextResponse.json(await listLeads({ statuses }));
  } catch {
    return NextResponse.json({ error: "Errore nel recupero dei lead" }, { status: 500 });
  }
}

/** Manual lead (phone call, referral, walk-in) */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const str = (k: string) => (typeof body[k] === "string" && (body[k] as string).trim() ? (body[k] as string).trim() : null);
  const name = str("name");
  if (!name) return NextResponse.json({ error: "Il nome è obbligatorio" }, { status: 400 });
  if (!str("phone") && !str("email")) {
    return NextResponse.json({ error: "Serve almeno telefono o email" }, { status: 400 });
  }
  const notes = str("notes");
  try {
    const { lead } = await ingestLead(
      {
        externalId: `manual_${randomUUID()}`,
        name,
        phone: str("phone") ?? "",
        email: str("email"),
        company: str("company"),
        service: str("service"),
        context: {},
        formData: notes ? { note: notes } : {},
      },
      "manuale",
      { notify: false, actor: { id: auth.user.id, name: auth.user.name } }
    );
    return NextResponse.json(lead, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore nella creazione del lead" }, { status: 500 });
  }
}
